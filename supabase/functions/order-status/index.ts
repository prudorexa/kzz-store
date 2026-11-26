
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAllowedOrigin, jsonResponse } from "../_shared/cors.ts";

Deno.serve(async (request) => {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return jsonResponse({ error: "Origin is not allowed." }, 403, origin);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: jsonResponse({}, 200, origin).headers });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, origin);
  }

  try {
    const { orderNumber, accessToken } = await request.json();
    if (
      typeof orderNumber !== "string" ||
      !/^KZZ-[A-F0-9]{8}$/.test(orderNumber) ||
      typeof accessToken !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accessToken)
    ) {
      return jsonResponse({ error: "Invalid order lookup." }, 400, origin);
    }
    const database = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await database
      .from("orders")
      .select("id,order_number,payment_method,payment_status,fulfillment_status,fulfillment_method,delivery_distance_band,town,delivery_address,total_ksh,mpesa_result_description,created_at,order_items(product_name,size,color,quantity,unit_price_ksh)")
      .eq("order_number", orderNumber)
      .eq("access_token", accessToken)
      .maybeSingle();
    if (error) throw error;
    if (!data) return jsonResponse({ error: "Order not found." }, 404, origin);

    if (
      data.payment_method === "mpesa"
      && data.payment_status === "pending"
      && Date.now() - new Date(data.created_at).getTime() > 10 * 60 * 1000
    ) {
      await database.rpc("cancel_mpesa_order", {
        p_order_id: data.id,
        p_result_description: "Payment confirmation timed out",
      });
      data.payment_status = "failed";
      data.mpesa_result_description = "Payment confirmation timed out";
    }

    return jsonResponse({
      orderNumber: data.order_number,
      paymentMethod: data.payment_method,
      status: data.payment_status,
      paymentStatus: data.payment_status,
      fulfillmentStatus: data.fulfillment_status,
      fulfillmentMethod: data.fulfillment_method,
      deliveryDistanceBand: data.delivery_distance_band,
      town: data.town,
      deliveryAddress: data.delivery_address,
      total: data.total_ksh,
      message: data.mpesa_result_description,
      createdAt: data.created_at,
      items: data.order_items,
    }, 200, origin);
  } catch (error) {
    console.error("Order status lookup failed", error);
    return jsonResponse({ error: "Couldn’t check your order status." }, 500, origin);
  }
});

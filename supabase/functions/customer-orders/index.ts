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
    return jsonResponse({ error: "Method not allowed." }, 405, origin);
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!accessToken) return jsonResponse({ error: "Sign in to view your orders." }, 401, origin);

  try {
    const database = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData, error: userError } = await database.auth.getUser(accessToken);
    const email = userData.user?.email;
    if (userError || !email || !userData.user?.email_confirmed_at) {
      return jsonResponse({ error: "Verify your email to view your orders." }, 401, origin);
    }

    const escapedEmail = email.replace(/[\\%_]/g, "\\$&");
    const { data, error } = await database
      .from("orders")
      .select("order_number,access_token,payment_method,payment_status,fulfillment_status,fulfillment_method,delivery_distance_band,delivery_address,estimated_delivery_date,courier_name,courier_tracking_url,total_ksh,created_at,order_items(product_name,size,color,quantity,unit_price_ksh)")
      .ilike("email", escapedEmail)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return jsonResponse({
      orders: (data ?? []).map((order) => ({
        orderNumber: order.order_number,
        accessToken: order.access_token,
        paymentMethod: order.payment_method,
        paymentStatus: order.payment_status,
        fulfillmentStatus: order.fulfillment_status,
        fulfillmentMethod: order.fulfillment_method,
        deliveryDistanceBand: order.delivery_distance_band,
        deliveryAddress: order.delivery_address,
        estimatedDeliveryDate: order.estimated_delivery_date,
        courierName: order.courier_name,
        courierTrackingUrl: order.courier_tracking_url,
        total: order.total_ksh,
        createdAt: order.created_at,
        items: order.order_items,
      })),
    }, 200, origin);
  } catch (error) {
    console.error("Customer order lookup failed", error);
    return jsonResponse({ error: "Couldn’t load your orders." }, 500, origin);
  }
});

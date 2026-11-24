import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const expectedToken = Deno.env.get("MPESA_CALLBACK_TOKEN");
  const receivedToken = new URL(request.url).searchParams.get("token");
  if (!expectedToken || receivedToken !== expectedToken) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const payload = await request.json();
    const callback = payload?.Body?.stkCallback;
    const checkoutRequestId = callback?.CheckoutRequestID;
    const resultCode = Number(callback?.ResultCode);
    if (typeof checkoutRequestId !== "string" || !Number.isInteger(resultCode)) {
      return new Response("Invalid callback", { status: 400 });
    }

    const metadata = callback?.CallbackMetadata?.Item ?? [];
    const valueFor = (name: string) => metadata.find((item: { Name: string }) => item.Name === name)?.Value;
    const amount = Number(valueFor("Amount") ?? 0);
    const receipt = valueFor("MpesaReceiptNumber");
    const description = String(callback.ResultDesc ?? "M-Pesa payment result").slice(0, 500);
    const database = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (resultCode === 0) {
      const { error } = await database.rpc("complete_mpesa_order", {
        p_checkout_request_id: checkoutRequestId,
        p_amount: amount,
        p_receipt_number: typeof receipt === "string" ? receipt : null,
        p_result_code: resultCode,
        p_result_description: description,
      });
      if (error) throw error;
    } else {
      const { error } = await database.rpc("fail_mpesa_order", {
        p_checkout_request_id: checkoutRequestId,
        p_result_code: resultCode,
        p_result_description: description,
      });
      if (error) throw error;
    }

    return new Response("Accepted", { status: 200 });
  } catch (error) {
    console.error("M-Pesa callback processing failed", error);
    return new Response("Callback processing failed", { status: 500 });
  }
});

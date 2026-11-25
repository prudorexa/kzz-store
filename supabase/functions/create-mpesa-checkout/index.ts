import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAllowedOrigin, jsonResponse } from "../_shared/cors.ts";

type CheckoutItem = { productId: string; size: string; color?: string; quantity: number };
type CheckoutBody = {
  paymentMethod?: "mpesa" | "cash_on_delivery";
  customer: {
    name: string;
    email: string;
    phone: string;
    county: string;
    town: string;
    address: string;
  };
  items: CheckoutItem[];
};

function effectiveProductPrice(product: {
  price_ksh: number;
  compare_at_price_ksh: number | null;
  offer_starts_at: string | null;
  offer_ends_at: string | null;
}, now: number) {
  if (product.compare_at_price_ksh == null) return product.price_ksh;
  const startsAt = product.offer_starts_at ? Date.parse(product.offer_starts_at) : null;
  const endsAt = product.offer_ends_at ? Date.parse(product.offer_ends_at) : null;
  const offerIsActive =
    (startsAt == null || now >= startsAt) &&
    (endsAt == null || now < endsAt);
  return offerIsActive ? product.price_ksh : product.compare_at_price_ksh;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^[17]\d{8}$/.test(digits)) return `254${digits}`;
  return null;
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server setting: ${name}`);
  return value;
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

async function sendOrderConfirmationEmail(
  email: string,
  name: string,
  orderNumber: string,
  accessToken: string,
  items: Array<{ product_name: string; size: string; color?: string; quantity: number; unit_price_ksh: number }>,
  total: number,
  paymentMethod: "mpesa" | "cash_on_delivery",
) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("ORDER_EMAIL_FROM");
  const configuredSiteUrl = Deno.env.get("PUBLIC_SITE_URL");
  if (!apiKey || !sender || !configuredSiteUrl) {
    console.error("Order confirmation email skipped: configure RESEND_API_KEY, ORDER_EMAIL_FROM, and PUBLIC_SITE_URL.");
    return false;
  }

  try {
    const siteUrl = new URL(configuredSiteUrl);
    if (siteUrl.protocol !== "https:" && siteUrl.hostname !== "localhost") {
      throw new Error("PUBLIC_SITE_URL must use HTTPS.");
    }
    const trackingUrl = `${siteUrl.origin}/track/${encodeURIComponent(orderNumber)}#${encodeURIComponent(accessToken)}`;
    const safeName = escapeHtml(name);
    const safeOrderNumber = escapeHtml(orderNumber);
    const itemLines = items.map((item) =>
      `${item.quantity} × ${item.product_name} · ${item.size}${item.color ? ` · ${item.color}` : ""} — KSh ${(item.unit_price_ksh * item.quantity).toLocaleString("en-KE")}`
    );
    const htmlItems = items.map((item) =>
      `<li>${item.quantity} × ${escapeHtml(item.product_name)} · Size ${escapeHtml(item.size)}${item.color ? ` · ${escapeHtml(item.color)}` : ""} — KSh ${(item.unit_price_ksh * item.quantity).toLocaleString("en-KE")}</li>`
    ).join("");
    const paymentNote = paymentMethod === "cash_on_delivery"
      ? "Pay cash to the delivery person when your order arrives."
      : "Check your phone for the M-Pesa payment prompt.";
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject: `KZZ order ${orderNumber} — tracking link`,
        html: `<div style="font-family:Arial,sans-serif;color:#44332f;line-height:1.6"><h1 style="color:#59443a">Thanks for shopping with KZZ Kids Luxe!</h1><p>Hello ${safeName}, your order <strong>${safeOrderNumber}</strong> has been received. ${escapeHtml(paymentNote)}</p><ul>${htmlItems}</ul><p><strong>Total: KSh ${total.toLocaleString("en-KE")}</strong></p><p><a href="${trackingUrl}" style="display:inline-block;background:#59443a;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none">Track your order</a></p><p>You can use this private link to see your items, payment, and delivery progress. Keep it private.</p></div>`,
        text: `Thanks for shopping with KZZ Kids Luxe, ${name}!\n\nOrder ${orderNumber}\n${itemLines.join("\n")}\n\nTotal: KSh ${total.toLocaleString("en-KE")}\n${paymentNote}\n\nTrack your order: ${trackingUrl}\nKeep this private link safe.`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("Order confirmation email failed with Resend status", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Order confirmation email could not be sent", error);
    return false;
  }
}

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

  let database: ReturnType<typeof createClient> | null = null;
  let createdOrderId: string | null = null;
  try {
    const body = await request.json() as CheckoutBody;
    const customer = body.customer;
    const paymentMethod = body.paymentMethod ?? "mpesa";
    if (paymentMethod !== "mpesa" && paymentMethod !== "cash_on_delivery") {
      return jsonResponse({ error: "Choose a supported payment method." }, 400, origin);
    }
    const phone = typeof customer?.phone === "string" ? normalizePhone(customer.phone) : null;
    if (!phone) return jsonResponse({ error: "Enter a valid Kenyan phone number." }, 400, origin);
    if (
      !customer ||
      !customer.name?.trim() ||
      !customer.email?.trim() ||
      !customer.county?.trim() ||
      !customer.town?.trim() ||
      !customer.address?.trim()
    ) {
      return jsonResponse({ error: "Complete all customer and delivery details." }, 400, origin);
    }
    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 30) {
      return jsonResponse({ error: "Your cart is empty or contains too many items." }, 400, origin);
    }

    const quantities = new Set<string>();
    for (const item of body.items) {
      if (
        typeof item.productId !== "string" ||
        typeof item.size !== "string" ||
        (item.color !== undefined && typeof item.color !== "string") ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 20
      ) {
        return jsonResponse({ error: "The cart contains an invalid item." }, 400, origin);
      }
      const key = `${item.productId}|${item.size}|${item.color ?? ""}`;
      if (quantities.has(key)) return jsonResponse({ error: "Remove duplicate cart lines and try again." }, 400, origin);
      quantities.add(key);
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    database = createClient(supabaseUrl, serviceKey);
    const productIds = [...new Set(body.items.map((item) => item.productId))];
    const { data: products, error: productsError } = await database
      .from("products")
      .select("id,name,price_ksh,compare_at_price_ksh,offer_starts_at,offer_ends_at,sizes,colors,stock,active")
      .in("id", productIds);
    if (productsError) throw productsError;

    const productById = new Map((products ?? []).map((product) => [product.id, product]));
    const pricingTime = Date.now();
    let total = 0;
    const requestedStock = new Map<string, number>();
    for (const item of body.items) {
      const product = productById.get(item.productId);
      if (!product || !product.active) {
        return jsonResponse({ error: "A product in your cart is no longer available." }, 409, origin);
      }
      if (!Array.isArray(product.sizes) || !product.sizes.includes(item.size)) {
        return jsonResponse({ error: `Size ${item.size} is no longer available for ${product.name}.` }, 409, origin);
      }
      const color = item.color ?? "";
      const colors = Array.isArray(product.colors) ? product.colors : [];
      if ((colors.length && !colors.includes(color)) || (!colors.length && color)) {
        return jsonResponse({ error: `Colour ${color} is no longer available for ${product.name}.` }, 409, origin);
      }
      requestedStock.set(product.id, (requestedStock.get(product.id) ?? 0) + item.quantity);
      const unitPrice = effectiveProductPrice(product, pricingTime);
      total += unitPrice * item.quantity;
    }
    for (const [productId, quantity] of requestedStock) {
      const product = productById.get(productId);
      if (product && product.stock < quantity) {
        return jsonResponse({ error: `There isn’t enough stock for ${product.name}.` }, 409, origin);
      }
    }
    if (!Number.isSafeInteger(total) || total < 1) {
      return jsonResponse({ error: "The order total is invalid." }, 400, origin);
    }
    const deliveryFee = total >= 5000 ? 0 : customer.county.trim() === "Nairobi" ? 250 : 350;
    total += deliveryFee;

    const orderId = crypto.randomUUID();
    createdOrderId = orderId;
    const orderNumber = `KZZ-${orderId.replaceAll("-", "").slice(0, 8).toUpperCase()}`;
    const accessToken = crypto.randomUUID();
    if (paymentMethod === "cash_on_delivery") {
      const { data: codTotal, error: codError } = await database.rpc("create_cash_on_delivery_order", {
        p_order_id: orderId,
        p_order_number: orderNumber,
        p_access_token: accessToken,
        p_customer_name: customer.name.trim().slice(0, 120),
        p_email: customer.email.trim().slice(0, 254),
        p_phone: phone,
        p_county: customer.county.trim().slice(0, 80),
        p_town: customer.town.trim().slice(0, 100),
        p_delivery_address: customer.address.trim().slice(0, 500),
        p_items: body.items.map((item) => ({
          product_id: item.productId,
          size: item.size,
          color: item.color ?? "",
          quantity: item.quantity,
        })),
      });
      if (codError) {
        createdOrderId = null;
        console.error("Cash-on-delivery order could not be created", codError);
        return jsonResponse({ error: codError.message || "Could not place this order. Please try again." }, 409, origin);
      }
      const { data: savedItems, error: savedItemsError } = await database
        .from("order_items")
        .select("product_name,size,color,quantity,unit_price_ksh")
        .eq("order_id", orderId);
      if (savedItemsError) throw savedItemsError;
      const emailSent = await sendOrderConfirmationEmail(
        customer.email.trim().slice(0, 254),
        customer.name.trim().slice(0, 120),
        orderNumber,
        accessToken,
        savedItems ?? [],
        Number(codTotal),
        paymentMethod,
      );
      return jsonResponse({
        orderId,
        orderNumber,
        accessToken,
        total: Number(codTotal),
        paymentMethod,
        message: "Cash is due when your order is delivered.",
        emailSent,
      }, 201, origin);
    }

    const { data: reservedTotal, error: reserveError } = await database.rpc("reserve_mpesa_order", {
      p_order_id: orderId,
      p_order_number: orderNumber,
      p_access_token: accessToken,
      p_customer_name: customer.name.trim().slice(0, 120),
      p_email: customer.email.trim().slice(0, 254),
      p_phone: phone,
      p_county: customer.county.trim().slice(0, 80),
      p_town: customer.town.trim().slice(0, 100),
      p_delivery_address: customer.address.trim().slice(0, 500),
      p_items: body.items.map((item) => ({
        product_id: item.productId,
        size: item.size,
        color: item.color ?? "",
        quantity: item.quantity,
      })),
    });
    if (reserveError) throw reserveError;
    total = Number(reservedTotal);
    const { data: savedItems, error: savedItemsError } = await database
      .from("order_items")
      .select("product_name,size,color,quantity,unit_price_ksh")
      .eq("order_id", orderId);
    if (savedItemsError) throw savedItemsError;

    const environment = Deno.env.get("MPESA_ENV") === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
    const shortCode = requiredEnv("MPESA_SHORTCODE");
    const passKey = requiredEnv("MPESA_PASSKEY");
    const consumerKey = requiredEnv("MPESA_CONSUMER_KEY");
    const consumerSecret = requiredEnv("MPESA_CONSUMER_SECRET");
    const callbackToken = requiredEnv("MPESA_CALLBACK_TOKEN");
    const projectUrl = requiredEnv("SUPABASE_URL");
    const callbackUrl = `${projectUrl}/functions/v1/mpesa-callback?token=${encodeURIComponent(callbackToken)}`;
    const timeParts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Nairobi",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const part = (type: string) => timeParts.find((value) => value.type === type)?.value ?? "";
    const timestamp = `${part("year")}${part("month")}${part("day")}${part("hour")}${part("minute")}${part("second")}`;
    const password = btoa(`${shortCode}${passKey}${timestamp}`);
    const auth = btoa(`${consumerKey}:${consumerSecret}`);

    const tokenResponse = await fetch(`${environment}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error("Safaricom authentication failed. Check the Daraja app credentials.");
    }

    const stkResponse = await fetch(`${environment}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: Deno.env.get("MPESA_TRANSACTION_TYPE") ?? "CustomerPayBillOnline",
        Amount: total,
        PartyA: phone,
        PartyB: shortCode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: orderNumber,
        TransactionDesc: `KZZ order ${orderNumber}`,
      }),
    });
    const stkData = await stkResponse.json();
    if (!stkResponse.ok || stkData.ResponseCode !== "0" || !stkData.CheckoutRequestID) {
      const description = String(stkData.errorMessage ?? stkData.ResponseDescription ?? "M-Pesa could not start the payment.");
      await database.rpc("cancel_mpesa_order", {
        p_order_id: orderId,
        p_result_description: description.slice(0, 500),
      });
      return jsonResponse({ error: description }, 502, origin);
    }

    const { error: updateError } = await database.from("orders").update({
      mpesa_checkout_request_id: stkData.CheckoutRequestID,
      mpesa_result_description: "STK prompt sent",
    }).eq("id", orderId);
    if (updateError) throw updateError;

    const emailSent = await sendOrderConfirmationEmail(
      customer.email.trim().slice(0, 254),
      customer.name.trim().slice(0, 120),
      orderNumber,
      accessToken,
      savedItems ?? [],
      total,
      paymentMethod,
    );

    return jsonResponse({
      orderId,
      orderNumber,
      accessToken,
      total,
      paymentMethod,
      message: stkData.CustomerMessage ?? "Check your phone and enter your M-Pesa PIN.",
      emailSent,
    }, 202, origin);
  } catch (error) {
    console.error("M-Pesa checkout failed", error);
    if (database && createdOrderId) {
      const { error: updateError } = await database.rpc("cancel_mpesa_order", {
        p_order_id: createdOrderId,
        p_result_description: "Could not start M-Pesa payment",
      });
      if (updateError) console.error("Could not mark incomplete order as failed", updateError);
    }
    return jsonResponse({ error: "We couldn’t start M-Pesa payment. Please try again." }, 500, origin);
  }
});

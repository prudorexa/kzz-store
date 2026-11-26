import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useProducts } from "../hooks/useProducts.js";
import ProductPrice from "../components/ProductPrice.jsx";
import { formatKSh } from "../lib/format.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";
import {
  calculateDeliveryFee,
  DELIVERY_DISTANCE_BANDS,
  normalizeKenyanPhone,
} from "../lib/checkout.js";
import { BUSINESS_LOCATION } from "../lib/business.js";

const counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Machakos", "Kajiado", "Uasin Gishu", "Other"];
const field =
  "w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 text-base transition-colors focus:border-purple-vivid";
const label = "mb-1.5 block text-sm font-bold";
const primaryBtn =
  "inline-block rounded-full bg-purple-deep px-8 py-4 font-bold text-purple-tint transition-colors hover:bg-purple-vivid";

async function getCheckoutErrorMessage(error) {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // Fall back to the Functions client message when the response isn't JSON.
    }
  }
  return error?.message || "Couldn’t place your order. Please try again.";
}

export default function Checkout() {
  const { items, keyOf, total, clear, reconcileStock } = useCart();
  const { products, loading: productsLoading, error: productsError } = useProducts();
  const [pendingOrder, setPendingOrder] = useState(null);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [county, setCounty] = useState("");
  const [fulfillmentMethod, setFulfillmentMethod] = useState("delivery");
  const [deliveryDistanceBand, setDeliveryDistanceBand] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("mpesa");

  const isPickup = fulfillmentMethod === "pickup";
  const selectedDistanceBand = DELIVERY_DISTANCE_BANDS.find((band) => band.value === deliveryDistanceBand);
  const deliveryFee = calculateDeliveryFee(fulfillmentMethod, deliveryDistanceBand, total);
  const orderTotal = total + (deliveryFee ?? 0);

  useEffect(() => {
    if (!productsLoading && !productsError && products.length) reconcileStock(products);
  }, [productsLoading, productsError, products]);

  useEffect(() => {
    if (!pendingOrder) return undefined;
    let cancelled = false;
    let timeout;
    let expiryTimeout;

    async function checkStatus() {
      const { data, error: statusError } = await supabase.functions.invoke("order-status", {
        body: { orderNumber: pendingOrder.orderNumber, accessToken: pendingOrder.accessToken },
      });
      if (cancelled) return;

      if (statusError || !data) {
        setError("Still waiting for the payment update. We’ll keep checking.");
        timeout = window.setTimeout(checkStatus, 5000);
        return;
      }

      if (data.status === "paid") {
        clear();
        setCompletedOrder({
          name: pendingOrder.name,
          trackingUrl: pendingOrder.trackingUrl,
          emailSent: pendingOrder.emailSent,
          ...data,
        });
        setPendingOrder(null);
      } else if (data.status === "failed") {
        setError(data.message || "The payment did not complete. You can try again.");
        setPendingOrder(null);
      } else {
        timeout = window.setTimeout(checkStatus, 4000);
      }
    }

    expiryTimeout = window.setTimeout(() => {
      if (cancelled) return;
      setPendingOrder(null);
      setError("Payment confirmation timed out. If you approved M-Pesa, wait for the confirmation SMS before trying again.");
    }, 10 * 60 * 1000);
    checkStatus();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      window.clearTimeout(expiryTimeout);
    };
  }, [pendingOrder, clear]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!isSupabaseConfigured) {
      setError("Checkout is not connected yet. Configure Supabase before accepting payments.");
      return;
    }

    setSubmitting(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    const selectedPaymentMethod = paymentMethod;
    const normalizedPhone = normalizeKenyanPhone(String(form.phone || ""));
    if (!normalizedPhone) {
      setSubmitting(false);
      setError("Enter a valid Kenyan phone number, such as 0712 345 678.");
      return;
    }
    const { data, error: checkoutError } = await supabase.functions.invoke("create-mpesa-checkout", {
      body: {
        fulfillmentMethod,
        deliveryDistanceBand: isPickup ? null : form.deliveryDistanceBand,
        customer: {
          name: form.fullName,
          phone: normalizedPhone,
          email: form.email,
          county: isPickup ? "Kajiado" : form.county,
          town: isPickup ? "Ongata Rongai" : form.town,
          address: isPickup ? `Shop pickup: ${BUSINESS_LOCATION}` : form.address,
        },
        paymentMethod: selectedPaymentMethod,
        items: items.map((item) => ({
          productId: item.id,
          size: item.size,
          color: item.color || "",
          quantity: item.quantity,
        })),
      },
    });
    setSubmitting(false);

    if (checkoutError || !data?.orderId || !data?.orderNumber || !data?.accessToken) {
      setError(data?.error || await getCheckoutErrorMessage(checkoutError));
      return;
    }
    const order = {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      accessToken: data.accessToken,
      name: String(form.fullName),
      total: data.total ?? total,
      message: data.message,
      emailSent: data.emailSent,
      fulfillmentMethod,
      trackingUrl: `${window.location.origin}/track/${encodeURIComponent(data.orderNumber)}#${encodeURIComponent(data.accessToken)}`,
    };
    if (selectedPaymentMethod === "cash_on_delivery") {
      clear();
      setCompletedOrder({ ...order, paymentMethod: selectedPaymentMethod, paymentStatus: "pending", fulfillmentStatus: "processing" });
    } else {
      setPendingOrder(order);
    }
  }

  if (completedOrder) {
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-7xl" aria-hidden="true">🎉</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold">
          {completedOrder.paymentMethod === "cash_on_delivery" ? "Order placed" : "Payment received"}, {completedOrder.name.split(" ")[0]}!
        </h1>
        <p className="mt-3 text-lg leading-7 text-ink/75">
          Order <strong>{completedOrder.orderNumber}</strong> for {formatKSh(completedOrder.total)} is confirmed.
          {completedOrder.fulfillmentMethod === "pickup" && <span className="block">Collect your order from {BUSINESS_LOCATION}.</span>}
          {completedOrder.paymentMethod === "cash_on_delivery" && completedOrder.fulfillmentMethod !== "pickup" && <span className="block">Pay {formatKSh(completedOrder.total)} in cash when your order is delivered.</span>}
          {completedOrder.paymentMethod === "cash_on_delivery" && completedOrder.fulfillmentMethod === "pickup" && <span className="block">Pay {formatKSh(completedOrder.total)} in cash when you collect your order.</span>}
          {completedOrder.paymentMethod !== "cash_on_delivery" && completedOrder.message && <span className="mt-2 block text-sm">M-Pesa receipt: {completedOrder.message}</span>}
        </p>
        <p className="mt-3 text-sm text-ink/65">
          {completedOrder.emailSent ? "We emailed you a private order tracking link." : "Save this private link to check your order later."}
        </p>
        <Link to={completedOrder.trackingUrl.replace(window.location.origin, "")} className="mt-4 inline-block font-bold text-purple-vivid underline">
          Track this order
        </Link>
        <Link to="/my-orders" className="mt-2 inline-block font-bold text-purple-vivid underline">
          View all my orders
        </Link>
        <Link to="/" className={`mt-8 ${primaryBtn}`}>Keep shopping</Link>
      </section>
    );
  }

  if (pendingOrder) {
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-purple-soft text-4xl" aria-hidden="true">📱</div>
        <h1 className="mt-5 font-display text-3xl font-extrabold">Check your phone</h1>
        <p className="mt-3 leading-7 text-ink/70">
          {pendingOrder.message || "Enter your M-Pesa PIN to approve the payment."}
          <span className="mt-2 block">Order {pendingOrder.orderNumber} · {formatKSh(pendingOrder.total)}</span>
        </p>
        <p className="mt-5 animate-pulse text-sm font-bold text-purple-vivid">Waiting for payment confirmation…</p>
        {error && <p role="status" className="mt-4 rounded-xl bg-purple-soft px-4 py-3 text-sm text-ink/75">{error}</p>}
        <p className="mt-4 text-sm text-ink/65">
          {pendingOrder.emailSent ? "We emailed you a private tracking link." : "We couldn’t email your tracking link. Save it before leaving this page."}
        </p>
        <Link
          to={pendingOrder.trackingUrl.replace(window.location.origin, "")}
          className="mt-3 inline-block font-bold text-purple-vivid underline"
        >
          Track this order
        </Link>
        <Link to="/my-orders" className="mt-2 inline-block font-bold text-purple-vivid underline">
          View all my orders
        </Link>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-xl px-5 py-20 text-center">
        <p className="text-7xl" aria-hidden="true">🧺</p>
        <h1 className="mt-4 font-display text-4xl font-extrabold">Your cart is empty</h1>
        <p className="mt-3 text-ink/70">Add something to your cart before checking out.</p>
        <Link to="/" className={`mt-8 ${primaryBtn}`}>Back to the shop</Link>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <h1 className="mb-10 text-center font-display text-5xl font-extrabold tracking-tight">Checkout</h1>

      {!isSupabaseConfigured && (
        <p role="status" className="mx-auto mb-7 max-w-3xl rounded-2xl border border-purple-mid bg-purple-soft px-5 py-4 text-sm leading-6">
          Demo mode: connect Supabase before checkout can accept orders. M-Pesa payments also require Daraja configuration.
        </p>
      )}
      {error && (
        <p role="alert" className="mx-auto mb-7 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
        <form onSubmit={handleSubmit} className="rounded-3xl border border-purple-mid/70 bg-purple-tint p-6 sm:p-8">
          <h2 className="mb-5 font-display text-2xl font-extrabold">Customer information</h2>

          <label htmlFor="fullName" className={label}>Full name</label>
          <input id="fullName" name="fullName" type="text" required autoComplete="name" maxLength={120} placeholder="Enter your full name" className={`${field} mb-5`} />

          <div className="grid gap-x-5 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className={label}>{paymentMethod === "mpesa" ? "M-Pesa phone number" : "Phone number"}</label>
              <input
                id="phone" name="phone" type="tel" required autoComplete="tel"
                inputMode="tel" maxLength={16} placeholder="07XX XXX XXX or 2547XX…"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className={`${field} mb-5`}
              />
              {paymentMethod === "mpesa" && phone && normalizeKenyanPhone(phone) && (
                <p className="-mt-3 mb-5 text-xs font-bold text-purple-vivid">M-Pesa number: +{normalizeKenyanPhone(phone)}</p>
              )}
            </div>
            <div>
              <label htmlFor="email" className={label}>Email address</label>
              <input id="email" name="email" type="email" required autoComplete="email" maxLength={254} placeholder="example@email.com" className={`${field} mb-5`} />
            </div>
          </div>

          <h2 className="mb-5 mt-4 font-display text-2xl font-extrabold">Delivery or pickup</h2>
          <fieldset className="mb-5 rounded-2xl border border-purple-mid/40 bg-purple-tint p-4">
            <legend className="px-1 font-bold">How would you like to get your order?</legend>
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl p-2">
              <input type="radio" name="fulfillmentMethod" value="delivery" checked={fulfillmentMethod === "delivery"} onChange={() => setFulfillmentMethod("delivery")} className="mt-1 accent-purple-deep" />
              <span><strong>Deliver to me</strong><span className="block text-sm leading-6 text-ink/65">Choose an estimated distance from our Ongata Rongai shop.</span></span>
            </label>
            <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-xl p-2">
              <input type="radio" name="fulfillmentMethod" value="pickup" checked={fulfillmentMethod === "pickup"} onChange={() => setFulfillmentMethod("pickup")} className="mt-1 accent-purple-deep" />
              <span><strong>Pick up from the shop</strong><span className="block text-sm leading-6 text-ink/65">{BUSINESS_LOCATION} · Free</span></span>
            </label>
          </fieldset>

          {!isPickup && (
            <>
              <div>
                <label htmlFor="deliveryDistanceBand" className={label}>Approximate distance from the shop</label>
                <select
                  id="deliveryDistanceBand"
                  name="deliveryDistanceBand"
                  required
                  value={deliveryDistanceBand}
                  onChange={(event) => setDeliveryDistanceBand(event.target.value)}
                  className={`${field} mb-5`}
                >
                  <option value="" disabled>Select distance</option>
                  {DELIVERY_DISTANCE_BANDS.map((band) => (
                    <option key={band.value} value={band.value}>
                      {band.label} · {formatKSh(total >= 5000 ? 0 : band.fee)}
                    </option>
                  ))}
                </select>
                {total >= 5000 && <p className="-mt-3 mb-5 text-sm font-bold text-purple-vivid">Your order qualifies for free delivery.</p>}
              </div>

              <div className="grid gap-x-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="county" className={label}>County</label>
                  <select id="county" name="county" required value={county} onChange={(event) => setCounty(event.target.value)} className={`${field} mb-5`}>
                    <option value="" disabled>Select county</option>
                    {counties.map((county) => <option key={county}>{county}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="town" className={label}>Town / area</label>
                  <input id="town" name="town" type="text" required maxLength={100} placeholder="e.g. Lang'ata" className={`${field} mb-5`} />
                </div>
              </div>

              <label htmlFor="address" className={label}>Delivery address</label>
              <textarea id="address" name="address" rows={4} required maxLength={500} placeholder="Building, street, landmark" className={`${field} mb-5 resize-y`} />
            </>
          )}

          <fieldset className="mb-7 rounded-2xl border border-purple-mid/40 bg-purple-tint p-4">
            <legend className="px-1 font-bold">Choose payment method</legend>
            <label className="mt-2 flex cursor-pointer items-start gap-3 rounded-xl p-2">
              <input type="radio" name="paymentMethod" value="mpesa" checked={paymentMethod === "mpesa"} onChange={() => setPaymentMethod("mpesa")} disabled={submitting} className="mt-1 accent-purple-deep" />
              <span><strong>Pay with M-Pesa</strong><span className="block text-sm leading-6 text-ink/65">We’ll send a secure payment prompt to your phone.</span></span>
            </label>
            <label className="mt-1 flex cursor-pointer items-start gap-3 rounded-xl p-2">
              <input type="radio" name="paymentMethod" value="cash_on_delivery" checked={paymentMethod === "cash_on_delivery"} onChange={() => setPaymentMethod("cash_on_delivery")} disabled={submitting} className="mt-1 accent-purple-deep" />
              <span><strong>{isPickup ? "Cash on pickup" : "Cash on delivery"}</strong><span className="block text-sm leading-6 text-ink/65">{isPickup ? "Pay in cash when you collect your order." : "Pay the delivery person in cash when your order arrives."}</span></span>
            </label>
            {isPickup ? (
              <p className="mt-2 text-sm font-bold">Free shop pickup · {BUSINESS_LOCATION}</p>
            ) : deliveryDistanceBand && (
              <p className="mt-2 text-sm font-bold">
                {total >= 5000 ? "Free delivery" : `${formatKSh(deliveryFee)} estimated delivery`}
                <span className="ml-1 font-normal text-ink/60">
                  · {selectedDistanceBand?.estimate}
                </span>
              </p>
            )}
          </fieldset>

          <button
            type="submit"
            disabled={submitting || !isSupabaseConfigured || (!isPickup && !deliveryDistanceBand)}
            className="w-full rounded-full bg-purple-deep py-4 text-lg font-bold text-purple-tint transition-colors hover:bg-purple-vivid disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Placing order…" : `Place order · ${formatKSh(orderTotal)}`}
          </button>
        </form>

        <aside className="h-fit rounded-3xl border border-purple-mid/70 bg-purple-soft p-6 sm:p-8 lg:sticky lg:top-24">
          <h2 className="mb-5 font-display text-2xl font-extrabold">Your order</h2>
          <ul className="divide-y divide-purple-mid/50">
            {items.map((item) => (
              <li key={keyOf(item)} className="flex items-center gap-3 py-3">
                <div className={`grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl ${item.tone || "bg-sky"}`}>
                  {item.image ? <img src={item.image} alt="" className="h-full w-full object-cover" /> : <span className="text-2xl">{item.emoji || "👕"}</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{item.name}</p>
                  <p className="text-sm text-ink/60">Size {item.size}{item.color ? ` · ${item.color}` : ""} · Qty {item.quantity}</p>
                </div>
                <ProductPrice
                  price={item.price * item.quantity}
                  originalPrice={item.originalPrice == null ? null : item.originalPrice * item.quantity}
                  className="items-end"
                  currentClassName="text-sm"
                  previousClassName="text-xs"
                />
              </li>
            ))}
          </ul>
          <div className="mt-5 space-y-2 border-t border-purple-mid/50 pt-5">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatKSh(total)}</span></div>
            <div className="flex justify-between text-sm"><span>{isPickup ? "Pickup" : "Delivery"}</span><span>{deliveryFee == null ? "Select distance" : deliveryFee === 0 ? "Free" : formatKSh(deliveryFee)}</span></div>
            <div className="flex items-center justify-between text-lg pt-2">
              <span>Total</span>
              <strong className="font-display text-2xl font-extrabold">{formatKSh(orderTotal)}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

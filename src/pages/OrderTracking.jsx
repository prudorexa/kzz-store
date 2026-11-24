import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatKSh } from "../lib/format.js";
import { getSafeTrackingUrl, ORDER_FULFILLMENT_STATUSES } from "../lib/orderStatus.js";
import { isSupabaseConfigured, supabase } from "../lib/supabase.js";

export default function OrderTracking() {
  const { orderNumber } = useParams();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const accessToken = window.location.hash.slice(1);

  useEffect(() => {
    let active = true;
    let interval;

    async function loadOrder() {
      if (!isSupabaseConfigured) {
        setError("Order tracking is not available until the store is connected.");
        setLoading(false);
        return;
      }
      if (!accessToken) {
        setError("Open the private tracking link from your order email.");
        setLoading(false);
        return;
      }

      const { data, error: lookupError } = await supabase.functions.invoke("order-status", {
        body: { orderNumber, accessToken },
      });
      if (!active) return;
      if (lookupError || !data) {
        setError("We couldn’t find this order. Check that you opened the complete tracking link from your email.");
        setLoading(false);
        return;
      }
      setOrder(data);
      setError("");
      setLoading(false);
    }

    loadOrder();
    if (!isSupabaseConfigured || !accessToken) return undefined;
    interval = window.setInterval(loadOrder, 45000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [orderNumber, accessToken, refreshKey]);

  const currentStep = ORDER_FULFILLMENT_STATUSES.findIndex(
    (status) => status.value === order?.fulfillmentStatus
  );
  const courierTrackingUrl = getSafeTrackingUrl(order?.courierTrackingUrl);

  return (
    <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="rounded-3xl border border-purple-mid/50 bg-purple-tint p-6 sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Guest order tracking</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">Your KZZ order</h1>
        <p className="mt-2 text-sm text-ink/60">{orderNumber}</p>

        {loading ? (
          <p role="status" className="mt-8 rounded-2xl bg-purple-soft p-5 text-sm">Loading your order…</p>
        ) : error ? (
          <div role="alert" className="mt-8 rounded-2xl border border-purple-mid/40 bg-purple-soft p-5">
            <p className="text-sm leading-6">{error}</p>
            <Link to="/" className="mt-4 inline-block font-bold text-purple-vivid underline">Back to the shop</Link>
          </div>
        ) : order && (
          <>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-purple-soft p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/55">Payment</p>
                <p className="mt-1 font-display text-xl font-extrabold">
                  {order.paymentMethod === "cash_on_delivery" && order.paymentStatus === "pending"
                    ? "Cash due on delivery"
                    : order.paymentStatus}
                </p>
                {order.message && <p className="mt-1 text-sm text-ink/65">{order.message}</p>}
              </div>
              <div className="rounded-2xl bg-purple-soft p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-ink/55">Delivery</p>
                <p className="mt-1 font-display text-xl font-extrabold">
                  {order.fulfillmentStatus === "awaiting_payment"
                    ? "Waiting for payment"
                    : ORDER_FULFILLMENT_STATUSES[currentStep]?.label || "Processing"}
                </p>
              </div>
            </div>

            {(order.estimatedDeliveryDate || order.courierName || courierTrackingUrl) && (
              <div className="mt-5 rounded-2xl bg-purple-soft p-5">
                <h2 className="font-display text-lg font-extrabold">Delivery details</h2>
                {order.estimatedDeliveryDate && (
                  <p className="mt-2 text-sm">
                    Estimated delivery: <strong>{new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(`${order.estimatedDeliveryDate}T00:00:00+03:00`))}</strong>
                  </p>
                )}
                {order.courierName && <p className="mt-1 text-sm">Courier: <strong>{order.courierName}</strong></p>}
                {courierTrackingUrl && (
                  <a href={courierTrackingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block font-bold text-purple-vivid underline">
                    Track with courier
                  </a>
                )}
              </div>
            )}

            {(order.paymentStatus === "paid" || order.paymentMethod === "cash_on_delivery") && (
              <ol className="mt-6 grid gap-2 sm:grid-cols-4" aria-label="Delivery progress">
                {ORDER_FULFILLMENT_STATUSES.map((status, index) => {
                  const complete = index <= currentStep;
                  return (
                    <li key={status.value} className={`rounded-xl px-3 py-3 text-center text-xs font-bold ${complete ? "bg-purple-deep text-purple-tint" : "bg-purple-soft text-ink/55"}`}>
                      <span className="block text-base">{complete ? "✓" : index + 1}</span>
                      {status.label}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="mt-8 border-t border-purple-mid/40 pt-6">
              <h2 className="font-display text-xl font-extrabold">Items in this order</h2>
              <ul className="mt-3 divide-y divide-purple-mid/30">
                {(order.items || []).map((item) => (
                  <li key={`${item.product_name}-${item.size}-${item.color || ""}`} className="flex flex-wrap justify-between gap-2 py-3 text-sm">
                    <span><strong>{item.quantity} × {item.product_name}</strong> · Size {item.size}{item.color ? ` · ${item.color}` : ""}</span>
                    <span className="font-bold">{formatKSh(item.unit_price_ksh * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex justify-between border-t border-purple-mid/40 pt-4">
                <span>Total</span>
                <strong className="font-display text-xl">{formatKSh(order.total)}</strong>
              </div>
              <p className="mt-3 text-xs text-ink/55">
                Ordered {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="mt-6 rounded-full border border-purple-mid/70 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-purple-soft"
            >
              Refresh status
            </button>
            <p className="mt-3 text-xs text-ink/50">This page refreshes automatically every 45 seconds. Keep this private link safe.</p>
          </>
        )}
      </div>
    </section>
  );
}

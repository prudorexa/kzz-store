import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatKSh } from "../lib/format.js";
import { getSafeTrackingUrl, ORDER_FULFILLMENT_STATUSES } from "../lib/orderStatus.js";
import { customerSupabase, isSupabaseConfigured } from "../lib/supabase.js";

const field =
  "w-full rounded-xl border border-purple-mid/60 bg-purple-tint px-4 py-3 text-base transition-colors focus:border-purple-vivid";
const label = "mb-1.5 block text-sm font-bold";

async function getOrderLookupErrorMessage(error) {
  const response = error?.context;
  if (response instanceof Response) {
    try {
      const body = await response.clone().json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // Fall back to the HTTP status when the response isn't JSON.
    }
    return `We couldn’t load your orders (HTTP ${response.status}). Please try again.`;
  }
  return "We couldn’t load your orders. Please refresh and try again.";
}

export default function MyOrders() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadOrders() {
    setLoadingOrders(true);
    setError("");
    const { data, error: lookupError } = await customerSupabase.functions.invoke("customer-orders");
    if (lookupError || !data || !Array.isArray(data.orders)) {
      if (lookupError) console.error("Customer order lookup failed", lookupError);
      else console.error("Unexpected customer order lookup response", data);
      setError(lookupError
        ? await getOrderLookupErrorMessage(lookupError)
        : "We couldn’t load your orders. Please refresh and try again.");
      setLoadingOrders(false);
      return;
    }
    setLoadingOrders(false);
    setOrders(data.orders);
  }

  useEffect(() => {
    let active = true;

    async function restoreSession() {
      const { data, error: sessionError } = await customerSupabase.auth.getSession();
      if (!active) return;
      if (sessionError) {
        setError("We couldn’t check your sign-in. Please refresh and try again.");
        return;
      }

      const sessionEmail = data.session?.user?.email;
      if (sessionEmail) {
        setEmail(sessionEmail);
        setVerifiedEmail(sessionEmail);
        setLoadingOrders(true);
        const { data: result, error: lookupError } = await customerSupabase.functions.invoke("customer-orders");
        if (!active) return;
        if (lookupError || !result || !Array.isArray(result.orders)) {
          if (lookupError) console.error("Customer order lookup failed", lookupError);
          else console.error("Unexpected customer order lookup response", result);
          setError(lookupError
            ? await getOrderLookupErrorMessage(lookupError)
            : "We couldn’t load your orders. Please refresh and try again.");
        } else {
          setOrders(result.orders);
        }
        setLoadingOrders(false);
      }
    }

    restoreSession();
    return () => {
      active = false;
    };
  }, []);

  async function requestCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const normalizedEmail = email.trim().toLowerCase();
    const { error: requestError } = await customerSupabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: { shouldCreateUser: true },
    });
    setBusy(false);
    if (requestError) {
      setError(
        requestError.message
          ? `We couldn’t send a verification code: ${requestError.message}`
          : "We couldn’t send a verification code. Please try again in a moment."
      );
      return;
    }
    setEmail(normalizedEmail);
    setCodeSent(true);
    setMessage("If this address can receive a sign-in code, one has been sent. Check your inbox and spam folder.");
  }

  async function verifyCode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { data, error: verificationError } = await customerSupabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (verificationError || !data.user?.email) {
      setError("That code is invalid or expired. Request a new code and try again.");
      return;
    }
    setVerifiedEmail(data.user.email);
    setCode("");
    await loadOrders();
  }

  async function signOut() {
    setBusy(true);
    const { error: signOutError } = await customerSupabase.auth.signOut();
    setBusy(false);
    if (signOutError) {
      setError("We couldn’t sign you out. Please try again.");
      return;
    }
    setVerifiedEmail("");
    setOrders([]);
    setCodeSent(false);
    setCode("");
    setMessage("");
    setError("");
  }

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="rounded-3xl border border-purple-mid/50 bg-purple-tint p-6 sm:p-9">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-coral">Secure guest access</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">My orders</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink/70">
          Enter the email used at checkout. We’ll send a one-time code to verify it before showing its orders.
        </p>

        {!isSupabaseConfigured ? (
          <p role="alert" className="mt-8 rounded-2xl bg-purple-soft p-5 text-sm">
            Order access is unavailable until the store is connected.
          </p>
        ) : verifiedEmail ? (
          <div className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink/70">Verified email: <strong>{verifiedEmail}</strong></p>
              <div className="flex gap-4">
                <button type="button" onClick={loadOrders} disabled={loadingOrders} className="text-sm font-bold text-purple-vivid underline disabled:opacity-50">
                  Refresh
                </button>
                <button type="button" onClick={signOut} disabled={busy} className="text-sm font-bold text-purple-vivid underline disabled:opacity-50">
                  Sign out
                </button>
              </div>
            </div>

            {loadingOrders ? (
              <p role="status" className="mt-6 rounded-2xl bg-purple-soft p-5 text-sm">Loading your orders…</p>
            ) : error ? (
              <div role="alert" className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <p>{error}</p>
                <button type="button" onClick={loadOrders} disabled={loadingOrders} className="mt-3 font-bold underline disabled:opacity-50">
                  Try again
                </button>
              </div>
            ) : orders.length === 0 ? (
              <p className="mt-6 rounded-2xl bg-purple-soft p-5 text-sm leading-6">
                No orders were found for this email. Check that you used the same email at checkout.
              </p>
            ) : (
              <ul className="mt-6 grid gap-5">
                {orders.map((order) => {
                  const fulfillment = ORDER_FULFILLMENT_STATUSES.find(
                    (status) => status.value === order.fulfillmentStatus
                  )?.label || "Processing";
                  const courierTrackingUrl = getSafeTrackingUrl(order.courierTrackingUrl);
                  const trackingUrl = `/track/${encodeURIComponent(order.orderNumber)}#${encodeURIComponent(order.accessToken)}`;
                  return (
                    <li key={order.orderNumber} className="rounded-2xl bg-purple-soft p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="font-display text-xl font-extrabold">{order.orderNumber}</h2>
                          <p className="mt-1 text-xs text-ink/60">
                            Ordered {new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.createdAt))}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{formatKSh(order.total)}</p>
                          <p className="mt-1 text-sm text-ink/70">
                            {order.paymentMethod === "cash_on_delivery" && order.paymentStatus === "pending"
                              ? "Cash due on delivery"
                              : order.paymentStatus}
                          </p>
                        </div>
                      </div>
                      <p className="mt-4 text-sm">
                        Delivery: <strong>{order.fulfillmentStatus === "awaiting_payment" ? "Waiting for payment" : fulfillment}</strong>
                      </p>
                      {(order.estimatedDeliveryDate || order.courierName || courierTrackingUrl) && (
                        <div className="mt-2 text-sm text-ink/70">
                          {order.estimatedDeliveryDate && (
                            <p>Estimated delivery: <strong>{new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeZone: "Africa/Nairobi" }).format(new Date(`${order.estimatedDeliveryDate}T00:00:00+03:00`))}</strong></p>
                          )}
                          {order.courierName && <p>Courier: <strong>{order.courierName}</strong></p>}
                          {courierTrackingUrl && (
                            <a href={courierTrackingUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-purple-vivid underline">
                              Track with courier
                            </a>
                          )}
                        </div>
                      )}
                      <ul className="mt-3 divide-y divide-purple-mid/30 border-y border-purple-mid/30">
                        {order.items.map((item, index) => (
                          <li key={`${item.product_name}-${item.size}-${index}`} className="flex justify-between gap-3 py-2 text-sm">
                            <span>{item.quantity} × {item.product_name} · Size {item.size}{item.color ? ` · ${item.color}` : ""}</span>
                            <span className="shrink-0 font-bold">{formatKSh(item.unit_price_ksh * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <Link to={trackingUrl} className="mt-4 inline-block font-bold text-purple-vivid underline">
                        View delivery tracking
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : (
          <form onSubmit={codeSent ? verifyCode : requestCode} className="mt-8 max-w-lg">
            {!codeSent ? (
              <>
                <label htmlFor="orderEmail" className={label}>Checkout email</label>
                <input
                  id="orderEmail"
                  type="email"
                  required
                  autoComplete="email"
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={`${field} mb-4`}
                  placeholder="you@example.com"
                />
                <button type="submit" disabled={busy} className="w-full rounded-full bg-purple-deep py-3.5 font-bold text-purple-tint transition-colors hover:bg-purple-vivid disabled:opacity-50">
                  {busy ? "Sending code…" : "Email me a verification code"}
                </button>
              </>
            ) : (
              <>
                <label htmlFor="emailCode" className={label}>Verification code</label>
                <input
                  id="emailCode"
                  type="text"
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={8}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  className={`${field} mb-4`}
                  placeholder="Enter the code from your email"
                />
                <button type="submit" disabled={busy} className="w-full rounded-full bg-purple-deep py-3.5 font-bold text-purple-tint transition-colors hover:bg-purple-vivid disabled:opacity-50">
                  {busy ? "Verifying…" : "Verify and view orders"}
                </button>
                <button type="button" onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }} className="mt-3 w-full text-sm font-bold text-purple-vivid underline">
                  Use a different email
                </button>
              </>
            )}
          </form>
        )}

        {message && <p role="status" className="mt-5 rounded-xl bg-purple-soft px-4 py-3 text-sm text-ink/75">{message}</p>}
        {error && !verifiedEmail && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      </div>
    </section>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { formatKSh } from "../lib/format.js";
import ProductPrice from "./ProductPrice.jsx";
import {
  DELIVERY_FEE_NAIROBI,
  DELIVERY_FEE_OTHER,
  FREE_DELIVERY_THRESHOLD,
} from "../lib/checkout.js";

export default function CartDrawer() {
  const { items, isOpen, closeCart, keyOf, increase, decrease, remove, total } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === "Escape" && closeCart();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, closeCart]);

  function goCheckout() {
    closeCart();
    navigate("/checkout");
  }

  const remainingForFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - total);

  return (
    <>
      <div
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-ink/50 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden="true"
      />

      <aside
        role="dialog"
        aria-label="Your cart"
        inert={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-purple-mid/40 bg-purple-tint transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-purple-mid/60 bg-white px-6 py-5">
          <h2 className="font-display text-2xl font-extrabold">Your cart 🛒</h2>
          <button
            onClick={closeCart}
            className="grid h-10 w-10 place-items-center rounded-full border border-purple-mid text-lg font-bold hover:bg-purple-soft"
            aria-label="Close cart"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="text-6xl">🧺</p>
                <p className="mt-3 font-display text-xl font-extrabold">Your cart is empty</p>
                <p className="mt-1 text-ink/60">Pick something from the shop to get started.</p>
              </div>
            </div>
          ) : (
            items.map((item) => {
              const key = keyOf(item);
              return (
                <div key={key} className="flex gap-4 rounded-2xl border border-purple-mid/50 bg-purple-soft/70 p-3">
                  <div className={`grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl ${item.tone || "bg-sky"}`}>
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-4xl">{item.emoji || "👕"}</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-extrabold">{item.name}</p>
                    <p className="text-sm text-ink/60">Size {item.size}{item.color ? ` · ${item.color}` : ""}</p>
                    <ProductPrice
                      price={item.price}
                      originalPrice={item.originalPrice}
                      className="mt-1 flex-col items-start"
                      currentClassName="text-sm"
                      previousClassName="text-xs"
                    />

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => decrease(key)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-ink font-bold text-white hover:bg-sun hover:text-ink"
                          aria-label={`Decrease ${item.name}`}
                        >
                          −
                        </button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button
                          onClick={() => increase(key)}
                          disabled={item.quantity >= (item.stock ?? 99)}
                          className="grid h-8 w-8 place-items-center rounded-full bg-ink font-bold text-white hover:bg-sun hover:text-ink"
                          aria-label={`Increase ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                      <button onClick={() => remove(key)} className="text-sm font-medium underline hover:text-ink/60">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t-2 border-ink p-6">
          {items.length > 0 && (
            <div className="mb-4 rounded-2xl bg-purple-soft p-3 text-sm">
              <p className="font-medium">
                Delivery: {formatKSh(DELIVERY_FEE_NAIROBI)} Nairobi · {formatKSh(DELIVERY_FEE_OTHER)} other counties
              </p>
              {remainingForFreeDelivery > 0 ? (
                <p className="mt-1">Add <strong>{formatKSh(remainingForFreeDelivery)}</strong> more for free delivery.</p>
              ) : (
                <p className="mt-1 font-bold text-purple-vivid">You’ve unlocked free delivery!</p>
              )}
              {remainingForFreeDelivery > 0 && (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-purple-mid/40">
                  <div
                    className="h-full rounded-full bg-purple-vivid"
                    style={{ width: `${Math.min(100, (total / FREE_DELIVERY_THRESHOLD) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
          <div className="mb-4 flex items-center justify-between text-lg">
            <span>Total</span>
            <strong className="font-display text-2xl font-extrabold">{formatKSh(total)}</strong>
          </div>
          <button
            onClick={goCheckout}
            disabled={items.length === 0}
            className="w-full rounded-full bg-purple-deep py-4 font-bold text-purple-tint transition-colors hover:bg-purple-vivid disabled:cursor-not-allowed disabled:bg-ink/25 disabled:hover:bg-ink/25 disabled:hover:text-white"
          >
            Go to checkout
          </button>
        </div>
      </aside>
    </>
  );
}

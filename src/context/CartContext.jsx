import { createContext, useContext, useEffect, useReducer, useState } from "react";
import { reconcileCartItems } from "../lib/cart.js";
import { resolveOfferPricing } from "../lib/offerSchedule.js";

// Same storage key as the original site, so saved carts carry over.
const STORAGE_KEY = "kzzCart";

const keyOf = (item) => `${item.id ?? item.name}|${item.size}|${item.color || ""}`;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function reducer(state, action) {
  switch (action.type) {
    case "add": {
      const exists = state.some((i) => keyOf(i) === keyOf(action.item));
      if (exists) {
        return state.map((i) =>
          keyOf(i) === keyOf(action.item)
            ? { ...i, quantity: Math.min(i.quantity + 1, i.stock ?? 99) }
            : i
        );
      }
      return [...state, { ...action.item, quantity: 1 }];
    }
    case "increase":
      return state.map((i) =>
        keyOf(i) === action.key
          ? { ...i, quantity: Math.min(i.quantity + 1, i.stock ?? 99) }
          : i
      );
    case "decrease":
      return state
        .map((i) => (keyOf(i) === action.key ? { ...i, quantity: i.quantity - 1 } : i))
        .filter((i) => i.quantity > 0);
    case "remove":
      return state.filter((i) => keyOf(i) !== action.key);
    case "clear":
      return [];
    case "replace":
      return action.items;
    case "refresh-prices":
      return state.map((item) => {
        const pricing = resolveOfferPricing({
          price: item.offerPrice ?? item.price,
          compareAtPrice: item.compareAtPrice ?? item.originalPrice,
          offerStartsAt: item.offerStartsAt,
          offerEndsAt: item.offerEndsAt,
        });
        return { ...item, price: pricing.price, originalPrice: pricing.originalPrice };
      });
    default:
      return state;
  }
}

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, dispatch] = useReducer(reducer, [], load);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch {
      /* storage unavailable: cart still works for this session */
    }
  }, [items]);

  useEffect(() => {
    const priceRefresh = window.setInterval(() => dispatch({ type: "refresh-prices" }), 30_000);
    return () => window.clearInterval(priceRefresh);
  }, []);

  const value = {
    items,
    isOpen,
    openCart: () => setOpen(true),
    closeCart: () => setOpen(false),
    keyOf,
    addItem: (product, size, color = "") =>
      dispatch({
        type: "add",
        item: {
          id: product.id,
          name: product.name,
          price: product.price,
          originalPrice: product.originalPrice,
          offerPrice: product.offerPrice ?? product.price,
          compareAtPrice: product.compareAtPrice ?? product.originalPrice,
          offerStartsAt: product.offerStartsAt ?? null,
          offerEndsAt: product.offerEndsAt ?? null,
          size,
          color,
          image: product.image,
          emoji: product.emoji,
          tone: product.tone,
          stock: Number(product.stock ?? 0),
        },
      }),
    increase: (key) => dispatch({ type: "increase", key }),
    decrease: (key) => dispatch({ type: "decrease", key }),
    remove: (key) => dispatch({ type: "remove", key }),
    clear: () => dispatch({ type: "clear" }),
    reconcileStock: (products) => dispatch({
      type: "replace",
      items: reconcileCartItems(items, products),
    }),
    count: items.reduce((n, i) => n + i.quantity, 0),
    total: items.reduce((sum, i) => sum + i.price * i.quantity, 0),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

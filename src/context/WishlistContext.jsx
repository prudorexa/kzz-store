import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "kzz-wishlist";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const [ids, setIds] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {
      // Wishlist still works for this session if storage is unavailable.
    }
  }, [ids]);

  function toggle(product) {
    setIds((current) =>
      current.some((id) => String(id) === String(product.id))
        ? current.filter((id) => String(id) !== String(product.id))
        : [...current, product.id]
    );
  }

  const value = {
    ids,
    isSaved: (product) => ids.some((id) => String(id) === String(product.id)),
    toggle,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return context;
}

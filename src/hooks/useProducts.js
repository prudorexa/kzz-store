import { useEffect, useState } from "react";
import { mockProducts } from "../data/mockProducts.js";
import {
  CATALOG_UPDATED_EVENT,
  normalizeProduct,
  readSavedCatalog,
} from "../lib/catalog.js";
import {
  isSupabaseConfigured,
  mapSupabaseProduct,
  PRODUCTS_UPDATED_EVENT,
  supabase,
} from "../lib/supabase.js";

export function useProducts() {
  const [state, setState] = useState({
    products: [],
    loading: true,
    usingSample: false,
    error: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from("products")
          .select("id,name,category,product_group,price_ksh,compare_at_price_ksh,offer_starts_at,offer_ends_at,cost_ksh,sizes,colors,stock,image_path,emoji,tone,active,created_at,description,care_instructions,size_guide,gallery_paths")
          .eq("active", true)
          .order("created_at", { ascending: false });

        if (cancelled) return;
        if (error) {
          setState({ products: [], loading: false, usingSample: false, error: error.message });
          return;
        }
        setState({
          products: data.map(mapSupabaseProduct),
          loading: false,
          usingSample: false,
          error: "",
        });
        return;
      }

      try {
        const saved = readSavedCatalog();
        if (saved) {
          if (!cancelled) {
            setState({ products: saved, loading: false, usingSample: true, error: "" });
          }
          return;
        }
      } catch {
        // Continue with demo products if browser storage is unavailable or invalid.
      }

      if (!cancelled) {
        setState({
          products: mockProducts.map(normalizeProduct),
          loading: false,
          usingSample: true,
          error: "",
        });
      }
    }

    const syncSavedCatalog = () => {
      if (isSupabaseConfigured) {
        load();
        return;
      }
      try {
        const saved = readSavedCatalog();
        if (saved) {
          setState({ products: saved, loading: false, usingSample: true, error: "" });
        }
      } catch {
        // Keep the current catalog visible if browser storage is unavailable or invalid.
      }
    };

    window.addEventListener(CATALOG_UPDATED_EVENT, syncSavedCatalog);
    window.addEventListener(PRODUCTS_UPDATED_EVENT, syncSavedCatalog);
    window.addEventListener("storage", syncSavedCatalog);
    const priceRefresh = window.setInterval(() => {
      setState((current) => ({
        ...current,
        products: current.products.map(normalizeProduct),
      }));
    }, 30_000);
    load();
    return () => {
      cancelled = true;
      window.clearInterval(priceRefresh);
      window.removeEventListener(CATALOG_UPDATED_EVENT, syncSavedCatalog);
      window.removeEventListener(PRODUCTS_UPDATED_EVENT, syncSavedCatalog);
      window.removeEventListener("storage", syncSavedCatalog);
    };
  }, []);

  return state;
}

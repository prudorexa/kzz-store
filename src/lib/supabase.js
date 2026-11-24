import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
export const customerSupabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { storageKey: "kzz-customer-orders-auth" },
    })
  : null;

export const PRODUCTS_UPDATED_EVENT = "kzz-products-updated";

export function notifyProductsUpdated() {
  window.dispatchEvent(new Event(PRODUCTS_UPDATED_EVENT));
}

export function mapSupabaseProduct(row) {
  const image = row.image_path
    ? supabase.storage.from("product-images").getPublicUrl(row.image_path).data.publicUrl
    : null;

  return {
    ...row,
    price: Number(row.price_ksh),
    cost: row.cost_ksh == null ? null : Number(row.cost_ksh),
    colors: row.colors || [],
    image,
    gallery: (row.gallery_paths || []).map((path) =>
      supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl
    ),
    description: row.description || "",
    careInstructions: row.care_instructions || "",
    sizeGuide: row.size_guide || "",
    galleryPaths: row.gallery_paths || [],
  };
}

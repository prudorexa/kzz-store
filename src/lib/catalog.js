export const CATALOG_STORAGE_KEY = "kzz.catalog";
export const CATALOG_UPDATED_EVENT = "kzz-catalog-updated";

export function normalizeProduct(product) {
  let sizes = product.sizes;
  if (typeof sizes === "string") {
    try {
      sizes = JSON.parse(sizes);
    } catch {
      sizes = sizes.split(",").map((size) => size.trim()).filter(Boolean);
    }
  }

  const image = product.image ? String(product.image) : null;
  const gallery = Array.isArray(product.gallery)
    ? product.gallery
    : Array.isArray(product.galleryPaths)
      ? product.galleryPaths
      : [];
  const colors = Array.isArray(product.colors)
    ? product.colors
    : typeof product.colors === "string"
      ? product.colors.split(",").map((color) => color.trim()).filter(Boolean)
      : [];
  return {
    ...product,
    id: product.id ?? product.name,
    price: Number(product.price),
    stock: Number(product.stock ?? 0),
    sizes: Array.isArray(sizes) && sizes.length ? sizes : ["One size"],
    colors,
    image: image && /^(data:|https?:\/\/)/i.test(image) ? image : image ? `/${image.replace(/^\/+/, "")}` : null,
    description: product.description || "",
    careInstructions: product.care_instructions || product.careInstructions || "",
    sizeGuide: product.size_guide || product.sizeGuide || "",
    gallery,
  };
}

export function readSavedCatalog() {
  const saved = window.localStorage.getItem(CATALOG_STORAGE_KEY);
  return saved ? JSON.parse(saved).map(normalizeProduct) : null;
}

export function saveCatalog(products) {
  window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(products));
  window.dispatchEvent(new Event(CATALOG_UPDATED_EVENT));
}

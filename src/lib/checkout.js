export const DELIVERY_FEE_NAIROBI = 250;
export const DELIVERY_FEE_OTHER = 350;
export const FREE_DELIVERY_THRESHOLD = 5000;
export const DELIVERY_ESTIMATE_NAIROBI = "1–2 working days";
export const DELIVERY_ESTIMATE_OTHER = "2–5 working days";

export function calculateDeliveryFee(county, subtotal) {
  if (!county) return null;
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return county === "Nairobi" ? DELIVERY_FEE_NAIROBI : DELIVERY_FEE_OTHER;
}

export function normalizeKenyanPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits) || /^1\d{8}$/.test(digits)) return `254${digits}`;
  return "";
}

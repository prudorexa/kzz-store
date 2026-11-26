export const FREE_DELIVERY_THRESHOLD = 5000;
export const DELIVERY_DISTANCE_BANDS = [
  { value: "up_to_5_km", label: "Up to 5 km", fee: 100, estimate: "Same or next day" },
  { value: "5_to_10_km", label: "5–10 km", fee: 150, estimate: "Same or next day" },
  { value: "10_to_20_km", label: "10–20 km", fee: 250, estimate: "1–2 working days" },
  { value: "over_20_km", label: "Over 20 km", fee: 350, estimate: "2–5 working days" },
];

export function calculateDeliveryFee(fulfillmentMethod, distanceBand, subtotal) {
  if (fulfillmentMethod === "pickup") return 0;
  if (fulfillmentMethod !== "delivery" || !distanceBand) return null;
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return DELIVERY_DISTANCE_BANDS.find((band) => band.value === distanceBand)?.fee ?? null;
}

export function normalizeKenyanPhone(value) {
  const digits = String(value).replace(/\D/g, "");
  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) return digits;
  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^7\d{8}$/.test(digits) || /^1\d{8}$/.test(digits)) return `254${digits}`;
  return "";
}

export const OFFER_TIME_ZONE = "Africa/Nairobi";

export function toNairobiDateTimeInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: OFFER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type) => parts.find((value) => value.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

export function nairobiDateTimeToIso(value) {
  if (!value) return null;
  const date = new Date(`${value}:00+03:00`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export function resolveOfferPricing({
  price,
  compareAtPrice,
  offerStartsAt,
  offerEndsAt,
  now = Date.now(),
}) {
  const offerPrice = Number(price);
  const regularPrice = compareAtPrice == null || compareAtPrice === ""
    ? null
    : Number(compareAtPrice);
  const startsAt = offerStartsAt ? new Date(offerStartsAt).getTime() : null;
  const endsAt = offerEndsAt ? new Date(offerEndsAt).getTime() : null;
  const outsideOfferWindow = regularPrice != null && (
    (startsAt != null && now < startsAt) ||
    (endsAt != null && now >= endsAt)
  );

  return {
    price: outsideOfferWindow ? regularPrice : offerPrice,
    originalPrice: outsideOfferWindow ? null : regularPrice,
    offerPrice,
    compareAtPrice: regularPrice,
    offerStartsAt: offerStartsAt || null,
    offerEndsAt: offerEndsAt || null,
  };
}

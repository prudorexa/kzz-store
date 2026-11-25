import test from "node:test";
import assert from "node:assert/strict";
import {
  nairobiDateTimeToIso,
  resolveOfferPricing,
  toNairobiDateTimeInput,
} from "./offerSchedule.js";

test("shows regular pricing before and after a scheduled offer", () => {
  const offer = {
    price: 1200,
    compareAtPrice: 1600,
    offerStartsAt: "2026-11-25T10:00:00+03:00",
    offerEndsAt: "2026-11-25T12:00:00+03:00",
  };

  assert.deepEqual(
    resolveOfferPricing({ ...offer, now: Date.parse("2026-11-25T09:59:59+03:00") }),
    {
      price: 1600,
      originalPrice: null,
      offerPrice: 1200,
      compareAtPrice: 1600,
      offerStartsAt: offer.offerStartsAt,
      offerEndsAt: offer.offerEndsAt,
    }
  );
  assert.equal(resolveOfferPricing({ ...offer, now: Date.parse("2026-11-25T10:00:00+03:00") }).price, 1200);
  assert.equal(resolveOfferPricing({ ...offer, now: Date.parse("2026-11-25T12:00:00+03:00") }).price, 1600);
});

test("converts offer dates using East Africa Time", () => {
  assert.equal(nairobiDateTimeToIso("2026-11-25T12:00"), "2026-11-25T09:00:00.000Z");
  assert.equal(toNairobiDateTimeInput("2026-11-25T09:00:00.000Z"), "2026-11-25T12:00");
});

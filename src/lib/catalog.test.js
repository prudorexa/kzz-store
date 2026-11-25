import test from "node:test";
import assert from "node:assert/strict";
import { normalizeProduct } from "./catalog.js";

test("normalizes clothing groups from local and Supabase product fields", () => {
  assert.equal(normalizeProduct({ productGroup: "Dresses" }).productGroup, "Dresses");
  assert.equal(normalizeProduct({ product_group: "Suits & formalwear" }).productGroup, "Suits & formalwear");
  assert.equal(normalizeProduct({}).productGroup, "Other");
});

test("normalizes optional compare-at prices from local and Supabase products", () => {
  assert.equal(normalizeProduct({ price: 1400, originalPrice: 1800 }).originalPrice, 1800);
  assert.equal(normalizeProduct({ price: 1400, compare_at_price_ksh: 1800 }).originalPrice, 1800);
  assert.equal(normalizeProduct({ price: 1400 }).originalPrice, null);
});

test("keeps scheduled offer price separate while showing the regular price before it starts", () => {
  const product = normalizeProduct({
    price: 1200,
    compare_at_price_ksh: 1600,
    offer_starts_at: "2099-11-25T10:00:00+03:00",
    offer_ends_at: "2099-11-25T12:00:00+03:00",
  });

  assert.equal(product.price, 1600);
  assert.equal(product.offerPrice, 1200);
  assert.equal(product.originalPrice, null);
});

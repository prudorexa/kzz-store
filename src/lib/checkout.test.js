import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDeliveryFee,
  DELIVERY_DISTANCE_BANDS,
  normalizeKenyanPhone,
} from "./checkout.js";

test("calculates delivery fees by distance and makes pickup free", () => {
  assert.deepEqual(
    DELIVERY_DISTANCE_BANDS.map(({ value }) => calculateDeliveryFee("delivery", value, 1000)),
    [100, 150, 250, 350],
  );
  assert.equal(calculateDeliveryFee("delivery", "up_to_5_km", 5000), 0);
  assert.equal(calculateDeliveryFee("pickup", null, 1000), 0);
  assert.equal(calculateDeliveryFee("delivery", null, 1000), null);
  assert.equal(calculateDeliveryFee("delivery", "unknown", 1000), null);
});

test("normalizes Kenyan M-Pesa phone formats", () => {
  assert.equal(normalizeKenyanPhone("0712 345 678"), "254712345678");
  assert.equal(normalizeKenyanPhone("254712345678"), "254712345678");
  assert.equal(normalizeKenyanPhone("712345678"), "254712345678");
  assert.equal(normalizeKenyanPhone("07123"), "");
});

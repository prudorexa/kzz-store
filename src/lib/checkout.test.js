import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDeliveryFee,
  normalizeKenyanPhone,
} from "./checkout.js";

test("calculates Nairobi and out-of-Nairobi delivery fees", () => {
  assert.equal(calculateDeliveryFee("Nairobi", 4999), 250);
  assert.equal(calculateDeliveryFee("Mombasa", 4999), 350);
  assert.equal(calculateDeliveryFee("Nairobi", 5000), 0);
  assert.equal(calculateDeliveryFee("", 1000), null);
});

test("normalizes Kenyan M-Pesa phone formats", () => {
  assert.equal(normalizeKenyanPhone("0712 345 678"), "254712345678");
  assert.equal(normalizeKenyanPhone("254712345678"), "254712345678");
  assert.equal(normalizeKenyanPhone("712345678"), "254712345678");
  assert.equal(normalizeKenyanPhone("07123"), "");
});

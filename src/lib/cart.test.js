import test from "node:test";
import assert from "node:assert/strict";
import { reconcileCartItems } from "./cart.js";

test("removes unavailable cart lines and caps quantities to live stock", () => {
  const result = reconcileCartItems(
    [
      { id: "a", quantity: 4 },
      { id: "b", quantity: 2 },
      { id: "c", quantity: 1 },
    ],
    [
      { id: "a", stock: 2 },
      { id: "b", stock: 0 },
    ]
  );

  assert.deepEqual(result, [{ id: "a", quantity: 2, stock: 2 }]);
});

test("keeps valid cart quantities when stock is sufficient", () => {
  assert.deepEqual(
    reconcileCartItems(
      [{ id: "a", quantity: 2 }],
      [{ id: "a", stock: 5 }]
    ),
    [{ id: "a", quantity: 2, stock: 5 }]
  );
});

test("refreshes the cart price when a product price changes", () => {
  const result = reconcileCartItems(
    [{ id: "a", quantity: 1, price: 1800 }],
    [{ id: "a", stock: 5, price: 1400, originalPrice: 1800 }]
  );

  assert.deepEqual(result, [{ id: "a", quantity: 1, price: 1400, originalPrice: 1800, stock: 5 }]);
});

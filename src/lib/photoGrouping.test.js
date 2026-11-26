import { test } from "node:test";
import assert from "node:assert/strict";
import { groupSimilarEmbeddings } from "./photoGrouping.js";

test("groups highly similar photos and leaves unrelated photos alone", () => {
  assert.deepEqual(
    groupSimilarEmbeddings([[1, 0], [0.99, 0.01], [0, 1]], 0.95),
    [[0, 1], [2]]
  );
});

test("does not chain together groups unless every photo pair is similar", () => {
  assert.deepEqual(
    groupSimilarEmbeddings([[1, 0], [0.95, 0.312], [0.8, 0.6]], 0.85),
    [[0, 1], [2]]
  );
});

test("rejects invalid thresholds and inconsistent embeddings", () => {
  assert.throws(() => groupSimilarEmbeddings([], 1.1), RangeError);
  assert.throws(() => groupSimilarEmbeddings([[1, 0], [1]], 0.8), TypeError);
});

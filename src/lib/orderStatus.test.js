import { test } from "node:test";
import assert from "node:assert/strict";
import { getSafeTrackingUrl } from "./orderStatus.js";

test("accepts HTTPS courier tracking links and rejects unsafe URLs", () => {
  assert.equal(getSafeTrackingUrl("https://courier.example/track/123"), "https://courier.example/track/123");
  assert.equal(getSafeTrackingUrl("javascript:alert(1)"), null);
  assert.equal(getSafeTrackingUrl("http://courier.example/track/123"), null);
  assert.equal(getSafeTrackingUrl("not a URL"), null);
  assert.equal(getSafeTrackingUrl(""), null);
});

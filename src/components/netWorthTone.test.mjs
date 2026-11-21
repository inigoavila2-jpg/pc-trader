import assert from "node:assert/strict";
import test from "node:test";
import { isNetWorthNegative } from "./netWorthTone.mjs";

test("only a below-zero net worth is negative", () => {
  assert.equal(isNetWorthNegative(-1), true);
  assert.equal(isNetWorthNegative(0), false);
  assert.equal(isNetWorthNegative(1), false);
  assert.equal(isNetWorthNegative(Number.NaN), false);
});

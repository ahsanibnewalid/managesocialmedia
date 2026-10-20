import test from "node:test";
import assert from "node:assert/strict";
import { isTrustedMutationOrigin } from "../lib/trusted-origin";

test("accepts an exact configured application origin", () => {
  assert.equal(isTrustedMutationOrigin("https://tidepost.example", "https://tidepost.example"), true);
});

test("rejects cross-origin requests", () => {
  assert.equal(isTrustedMutationOrigin("https://attacker.example", "https://tidepost.example"), false);
});

test("rejects origin differences in scheme or port", () => {
  assert.equal(isTrustedMutationOrigin("http://tidepost.example", "https://tidepost.example"), false);
  assert.equal(isTrustedMutationOrigin("https://tidepost.example:444", "https://tidepost.example"), false);
});

test("fails closed for missing or malformed origin configuration", () => {
  assert.equal(isTrustedMutationOrigin(null, "https://tidepost.example"), false);
  assert.equal(isTrustedMutationOrigin("https://tidepost.example", undefined), false);
  assert.equal(isTrustedMutationOrigin("not a url", "https://tidepost.example"), false);
  assert.equal(isTrustedMutationOrigin("https://tidepost.example", "not a url"), false);
});

test("rejects non-web URL schemes", () => {
  assert.equal(isTrustedMutationOrigin("javascript:alert(1)", "https://tidepost.example"), false);
});

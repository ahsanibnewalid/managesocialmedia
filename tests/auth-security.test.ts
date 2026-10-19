import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

const secret = randomBytes(32).toString("base64url");

test("session JWT requires Tidepost issuer and a valid positive user subject", () => {
  const token = jwt.sign({ email: "user@example.test" }, secret, { subject: "123", issuer: "tidepost", expiresIn: "12h" });
  const payload = jwt.verify(token, secret, { issuer: "tidepost" }) as jwt.JwtPayload;
  assert.equal(payload.sub, "123");
  assert.equal(payload.email, "user@example.test");
  assert.throws(() => jwt.verify(token, secret, { issuer: "other-app" }));
});

test("session JWT rejects expired and tampered tokens", () => {
  const expired = jwt.sign({ email: "user@example.test" }, secret, { subject: "123", issuer: "tidepost", expiresIn: -1 });
  assert.throws(() => jwt.verify(expired, secret, { issuer: "tidepost" }), /expired/i);
  const valid = jwt.sign({ email: "user@example.test" }, secret, { subject: "123", issuer: "tidepost", expiresIn: "12h" });
  const pieces = valid.split(".");
  pieces[2] = (pieces[2][0] === "a" ? "b" : "a") + pieces[2].slice(1);
  assert.throws(() => jwt.verify(pieces.join("."), secret, { issuer: "tidepost" }));
});

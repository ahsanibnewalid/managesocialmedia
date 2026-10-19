import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { decryptSocialToken, encryptSocialToken } from "../lib/social-token-vault";

const original = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  else process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = original;
});

test("AES-256-GCM token encryption round-trips credentials", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  const token = { accessToken: "access-secret", refreshToken: "refresh-secret", expiresAt: 123456789, scope: "read write" };
  const ciphertext = encryptSocialToken(token);
  assert.match(ciphertext, /^v1:/);
  assert.equal(ciphertext.includes(token.accessToken), false);
  assert.deepEqual(decryptSocialToken(ciphertext), token);
});

test("token vault rejects a tampered authentication tag/ciphertext", () => {
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString("base64");
  const ciphertext = encryptSocialToken({ accessToken: "private-token" });
  const parts = ciphertext.split(":");
  parts[3] = (parts[3][0] === "A" ? "B" : "A") + parts[3].slice(1);
  assert.throws(() => decryptSocialToken(parts.join(":")));
});

test("token vault rejects missing or incorrectly sized encryption keys", () => {
  delete process.env.SOCIAL_TOKEN_ENCRYPTION_KEY;
  assert.throws(() => encryptSocialToken({ accessToken: "x" }), /not configured/);
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = Buffer.alloc(16).toString("base64");
  assert.throws(() => encryptSocialToken({ accessToken: "x" }), /exactly 32 bytes/);
});

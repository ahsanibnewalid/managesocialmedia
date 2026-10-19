const { publishToSocialPlatform } = require("../lib/services/socialPublisher.ts");

const SUPPORTED_PLATFORMS = new Set(["facebook", "instagram", "linkedin", "x", "tiktok"]);

async function publishToPlatform({ platform, post, account }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) throw new Error(`Unsupported publishing platform: ${platform}`);
  if (!account?.external_id) throw new Error(`No provider account ID is stored for ${platform}`);
  const result = await publishToSocialPlatform({
    platform,
    text: post.text,
    externalAccountId: account.external_id,
    encryptedToken: account.token_ciphertext
  });
  return result;
}
module.exports = { publishToPlatform };

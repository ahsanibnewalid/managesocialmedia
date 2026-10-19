/**
 * Platform-specific API publishing belongs here.
 *
 * This registry deliberately fails closed until a platform adapter has been
 * implemented and configured. It must never report a fake successful publish.
 */
const SUPPORTED_PLATFORMS = new Set([
  "facebook",
  "instagram",
  "linkedin",
  "x",
  "tiktok"
]);

async function publishToPlatform({ platform }) {
  if (!SUPPORTED_PLATFORMS.has(platform)) {
    throw new Error(`Unsupported publishing platform: ${platform}`);
  }
  throw new Error(
    `Publishing adapter for ${platform} is not configured. Connect and validate the provider API before enabling the worker.`
  );
}

module.exports = { publishToPlatform };

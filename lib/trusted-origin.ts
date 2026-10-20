/**
 * Pure origin check so it can be regression-tested without a Next.js runtime.
 * APP_URL must be the canonical externally visible origin for the deployment.
 */
export function isTrustedMutationOrigin(origin: string | null, configuredAppUrl: string | undefined): boolean {
  if (!origin || !configuredAppUrl) return false;

  try {
    const originUrl = new URL(origin);
    const appUrl = new URL(configuredAppUrl);
    if (!["http:", "https:"].includes(originUrl.protocol)) return false;
    if (!["http:", "https:"].includes(appUrl.protocol)) return false;
    return originUrl.origin === appUrl.origin;
  } catch {
    return false;
  }
}

/**
 * Helper to get the canonical public base URL for the live web application.
 *
 * Ensures CTR buttons, payment links, and copied client portal URLs always point
 * to the live production webapp (defaults to https://montforddigital.com) rather than
 * temporary AI Studio cloud workstation or dev server links.
 */
export function getAppBaseUrl(): string {
  // 1. Explicit environment variable configured in hosting/build
  const envUrl = (import.meta.env.VITE_APP_URL as string | undefined)?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  // 2. If running in a browser on a live custom domain in production
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname.toLowerCase();
    const isDevEnvironment =
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.includes('.run.app') ||
      hostname.includes('ais-dev-') ||
      hostname.endsWith('.cloudworkstations.dev') ||
      hostname.endsWith('.googleusercontent.com') ||
      hostname.includes('webcontainer') ||
      hostname.includes('github.dev');

    if (!isDevEnvironment && window.location.origin) {
      return window.location.origin.replace(/\/+$/, '');
    }
  }

  // 3. Fallback to the live production webapp
  return 'https://montforddigital.com';
}

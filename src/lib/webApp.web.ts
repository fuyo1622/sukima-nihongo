/** The deployed build, set in the page by scripts/finalize-web.ts (null in the dev server). */
export const webBuild: string | null = (globalThis as { __SUKIMA_BUILD__?: string }).__SUKIMA_BUILD__ ?? null;

/** Asks the browser not to clear the app's storage when the phone runs low on space: progress lives there. */
export function keepStorage(): void {
  void navigator.storage?.persist?.().catch(() => false);
}

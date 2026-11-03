/** The deployed build, set in the page by scripts/finalize-web.ts (null in the dev server). */
export const appBuild: string | null = (globalThis as { __SUKIMA_BUILD__?: string }).__SUKIMA_BUILD__ ?? null;

/** What 我的 calls this kind of build, next to its id. */
export const buildKind = '網頁版';

/** Asks the browser not to clear the app's storage when the phone runs low on space: progress lives there. */
export function keepStorage(): void {
  void navigator.storage?.persist?.().catch(() => false);
}

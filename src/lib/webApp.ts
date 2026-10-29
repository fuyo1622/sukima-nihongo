/** Web app only (see webApp.web.ts): the native app has no build id here and needs no storage request. */
export const webBuild: string | null = null;

export function keepStorage(): void {}

/**
 * Android chooses CJK glyphs by system locale, so a Traditional Chinese phone would draw Japanese
 * kanji in their Chinese forms. Bundle Noto Sans JP (subset by `npm run build:content`; SIL OFL,
 * see assets/fonts/OFL.txt). Regular and bold are separate families: Android would otherwise fake
 * the bold weight from the regular font.
 */
export const FONT_ASSETS: Record<string, number> = {
  NotoSansJP: require('@/assets/fonts/NotoSansJP-Regular.ttf'),
  'NotoSansJP-Bold': require('@/assets/fonts/NotoSansJP-Bold.ttf'),
};

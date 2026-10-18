import { Platform, useColorScheme, type TextStyle } from 'react-native';

// 和紙 (washi) paper background, 藍 (indigo) as the primary colour, 朱 (vermilion) as the accent.
const light = {
  bg: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEAE0',
  border: '#E3DDD0',
  text: '#1D2230',
  textMuted: '#5F6673',
  textFaint: '#8A909B',
  primary: '#2F4E8C',
  onPrimary: '#FFFFFF',
  primarySoft: '#E2E8F4',
  accent: '#C8492A',
  onAccent: '#FFFFFF',
  accentSoft: '#FAE6DF',
  success: '#2C7A4B',
  successSoft: '#E0F1E6',
  danger: '#B93A2C',
  dangerSoft: '#F8E0DC',
  warning: '#9A6A12',
  warningSoft: '#FBF0D9',
};

const dark: typeof light = {
  bg: '#111318',
  surface: '#1B1E25',
  surfaceAlt: '#252932',
  border: '#2E333D',
  text: '#ECEDEF',
  textMuted: '#A3A9B4',
  textFaint: '#7C828D',
  primary: '#91A9E3',
  onPrimary: '#0E1322',
  primarySoft: '#1F2A45',
  accent: '#F08D6D',
  onAccent: '#1D0E08',
  accentSoft: '#3B241D',
  success: '#6BC98F',
  successSoft: '#18301F',
  danger: '#F2806F',
  dangerSoft: '#3A1F1B',
  warning: '#E2B45E',
  warningSoft: '#3A2F18',
};

export type Colors = typeof light;
export type ColorName = keyof Colors;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Japanese and Chinese share code points but not glyph shapes (e.g. 直, 骨, 角). Japanese text
 * gets a Japanese font so learners see the forms they will read in Japan; Chinese text gets a
 * Traditional Chinese font.
 */
export const fonts = {
  ja: Platform.select({
    ios: 'Hiragino Sans',
    android: 'NotoSansJP',
    web: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic UI", "Yu Gothic", Meiryo, sans-serif',
  }),
  zh: Platform.select({
    ios: 'PingFang TC',
    web: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif',
  }),
  latin: Platform.select({
    web: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  }),
};

export type Lang = keyof typeof fonts;

/**
 * Font style for Japanese text at a given weight. On Android the bundled Noto Sans JP is loaded as
 * two families (see ui/fonts.android.ts), so the weight picks the family instead of `fontWeight`.
 */
export function jaFont(weight?: TextStyle['fontWeight']): TextStyle {
  if (Platform.OS !== 'android') return { fontFamily: fonts.ja, fontWeight: weight };
  const bold = weight === 'bold' || Number(weight) >= 600;
  return { fontFamily: bold ? 'NotoSansJP-Bold' : 'NotoSansJP', fontWeight: 'normal', includeFontPadding: false };
}

export const typeScale = {
  display: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  title: { fontSize: 21, lineHeight: 29, fontWeight: '700' },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
} satisfies Record<string, TextStyle>;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

/** Content width cap so the layout still reads well on iPad and in the web preview. */
export const MAX_WIDTH = 560;
/** Room for the floating tab bar in the web preview; iOS insets scroll views natively. */
export const TAB_BAR_SPACE = Platform.OS === 'web' ? 88 : 0;

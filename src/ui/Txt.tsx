import { Text, type TextProps, type TextStyle } from 'react-native';

import { fonts, jaFont, typeScale, useColors, type ColorName, type Lang } from './theme';

export interface TxtProps extends TextProps {
  variant?: keyof typeof typeScale;
  color?: ColorName;
  /** Picks the font: Japanese, Traditional Chinese, or Latin. */
  lang?: Lang;
  size?: number;
  weight?: TextStyle['fontWeight'];
  center?: boolean;
}

export function Txt({ variant = 'body', color = 'text', lang = 'zh', size, weight, center, style, ...rest }: TxtProps) {
  const c = useColors();
  const resolvedWeight = weight ?? typeScale[variant].fontWeight;
  const font = lang === 'ja' ? jaFont(resolvedWeight) : { fontFamily: fonts[lang], fontWeight: resolvedWeight };
  return (
    <Text
      {...rest}
      style={[
        typeScale[variant],
        { color: c[color] },
        font,
        size !== undefined && { fontSize: size, lineHeight: Math.round(size * 1.35) },
        center && { textAlign: 'center' },
        style,
      ]}
    />
  );
}

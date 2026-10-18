import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { parseRuby, rubyBase } from '@/content/text';
import { BLANK } from '@/content/types';

import { jaFont, useColors } from './theme';

interface RubyProps {
  /** Japanese text in ruby notation: `{漢字|かんじ}`. */
  text: string;
  size?: number;
  /** Show furigana above annotated parts. */
  showRuby?: boolean;
  /** Text to show in the ＿＿ blank of a cloze sentence (after answering). */
  fill?: string;
  center?: boolean;
  bold?: boolean;
}

/**
 * Furigana. React Native has no <ruby>, so each annotated word becomes a small column with
 * its reading on top; plain text is split into characters so long sentences still wrap.
 */
export function Ruby({ text, size = 20, showRuby = true, fill, center, bold }: RubyProps) {
  const c = useColors();
  const segments = parseRuby(text);
  const rubySize = Math.max(9, Math.round(size * 0.46));
  const base = { ...jaFont(bold ? '700' : '400'), fontSize: size, lineHeight: Math.round(size * 1.4), color: c.text };
  const blankStyle = [styles.blank, { borderColor: fill ? c.success : c.primary, backgroundColor: fill ? c.successSoft : c.primarySoft }];
  const blankText = { ...base, ...jaFont('700'), color: fill ? c.success : c.primary };

  if (!showRuby || !segments.some((s) => s.ruby)) {
    const [before, after] = rubyBase(text).split(BLANK);
    return (
      <Text style={[base, center && styles.center]}>
        {before}
        {after !== undefined && <Text style={blankText}>{fill ? ` ${fill} ` : '＿＿＿'}</Text>}
        {after}
      </Text>
    );
  }

  const rubyStyle = { ...jaFont('400'), fontSize: rubySize, lineHeight: Math.round(rubySize * 1.3), color: c.textMuted };
  const cells: ReactNode[] = [];
  segments.forEach((seg, i) => {
    if (seg.ruby) {
      cells.push(
        <View key={i} style={styles.cell}>
          <Text style={rubyStyle}>{seg.ruby}</Text>
          <Text style={base}>{seg.text}</Text>
        </View>,
      );
      return;
    }
    seg.text.split(BLANK).forEach((part, j) => {
      if (j > 0) {
        cells.push(
          <View key={`${i}b${j}`} style={styles.cell}>
            <Text style={rubyStyle}> </Text>
            <View style={blankStyle}>
              <Text style={blankText}>{fill ?? '　　'}</Text>
            </View>
          </View>,
        );
      }
      [...part].forEach((ch, k) =>
        cells.push(
          <View key={`${i}-${j}-${k}`} style={styles.cell}>
            <Text style={rubyStyle}> </Text>
            <Text style={base}>{ch}</Text>
          </View>,
        ),
      );
    });
  });
  return <View style={[styles.row, center && styles.rowCenter]}>{cells}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  rowCenter: { justifyContent: 'center' },
  cell: { alignItems: 'center' },
  center: { textAlign: 'center' },
  blank: { borderBottomWidth: 2, borderRadius: 6, paddingHorizontal: 6, marginHorizontal: 2 },
});

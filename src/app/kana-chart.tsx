import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { speak } from '@/audio/speech';
import { KANA_ITEMS } from '@/content';
import { DAKUTEN_ROWS, GOJUON_ROWS, YOON_ROWS } from '@/content/kana';
import { toKatakana } from '@/content/text';
import { isMastered } from '@/engine/srs';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { Card, ModalScreen, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { MAX_WIDTH, radius, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const byKana = new Map(KANA_ITEMS.map((k) => [k.kana, k]));

export default function KanaChartScreen() {
  const c = useColors();
  const [script, setScript] = useState<'hiragana' | 'katakana'>('hiragana');
  const cards = useProgress((s) => s.data.cards);
  const { sound, speechRate } = useSettings((s) => s.settings);
  const convert = (k: string) => (script === 'hiragana' ? k : toKatakana(k));

  const cell = (hira: string | null, key: string, wide = false) => {
    if (!hira) return <View key={key} style={[styles.cell, wide && styles.wide]} />;
    const kana = convert(hira);
    const item = byKana.get(kana);
    const card = item ? cards[item.id] : undefined;
    const bg = card ? (isMastered(card) ? c.successSoft : c.primarySoft) : c.surface;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityLabel={`${kana} ${item?.romaji ?? ''}`}
        onPress={() => sound && void speak(kana, speechRate)}
        style={({ pressed }) => [styles.cell, wide && styles.wide, { backgroundColor: bg, borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}>
        <Txt lang="ja" size={wide ? 20 : 24}>
          {kana}
        </Txt>
        <Txt variant="caption" lang="latin" color="textMuted">
          {item?.romaji}
        </Txt>
      </Pressable>
    );
  };

  return (
    <ModalScreen>
      <View style={styles.header}>
        <Txt variant="title" style={{ flex: 1 }}>
          五十音表
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel="關閉" hitSlop={12} onPress={() => router.back()}>
          <Icon name="close" size={22} color={c.textMuted} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          <Segmented
            options={[
              { label: '平假名', value: 'hiragana' as const },
              { label: '片假名', value: 'katakana' as const },
            ]}
            value={script}
            onChange={setScript}
          />
          <View style={styles.legend}>
            <View style={[styles.swatch, { backgroundColor: c.primarySoft }]} />
            <Txt variant="caption" color="textMuted">
              學過
            </Txt>
            <View style={[styles.swatch, { backgroundColor: c.successSoft }]} />
            <Txt variant="caption" color="textMuted">
              熟練
            </Txt>
            <Txt variant="caption" color="textMuted" style={{ flex: 1, textAlign: 'right' }}>
              {sound ? '點一下聽發音' : '開啟有聲模式即可點擊發音'}
            </Txt>
          </View>

          <Txt variant="heading">清音</Txt>
          {GOJUON_ROWS.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((k, i) => cell(k, `g${r}-${i}`))}
            </View>
          ))}

          <Txt variant="heading">濁音・半濁音</Txt>
          {DAKUTEN_ROWS.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((k, i) => cell(k, `d${r}-${i}`))}
            </View>
          ))}

          <Txt variant="heading">拗音</Txt>
          {YOON_ROWS.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((k, i) => cell(k, `y${r}-${i}`, true))}
            </View>
          ))}

          <Card tone="primary">
            <Txt variant="caption" color="textMuted">
              小技巧：很多假名來自漢字的草書（平假名）或偏旁（片假名），例如「あ」來自「安」、「イ」來自「伊」。學習時卡片上會顯示字源。
            </Txt>
          </Card>
        </View>
      </ScrollView>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xxl, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MAX_WIDTH, gap: space.md },
  legend: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  row: { flexDirection: 'row', gap: space.sm },
  cell: { flex: 1, aspectRatio: 1, borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  wide: { aspectRatio: 1.4 },
});

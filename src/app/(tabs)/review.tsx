import { Pressable, StyleSheet, View } from 'react-native';

import { speak } from '@/audio/speech';
import type { Item } from '@/content/types';
import { speechFor } from '@/engine/exercises';
import { dueCount, recentAccuracy, weakItems } from '@/engine/progress';
import { isMastered } from '@/engine/srs';
import { beginBlock } from '@/features/beginBlock';
import { kunDisplay } from '@/features/quiz/ItemViews';
import { useNow } from '@/state/hooks';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { Button, Card, Divider, Screen, Section } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const DAY = 86_400_000;

function label(item: Item): { main: string; sub: string; meaning: string } {
  switch (item.type) {
    case 'kana':
      return { main: item.kana, sub: item.romaji, meaning: item.script === 'hiragana' ? '平假名' : '片假名' };
    case 'vocab':
    case 'trap':
      return { main: item.word, sub: item.word === item.reading ? '' : item.reading, meaning: item.meaning };
    case 'kanji':
      return { main: item.kanji, sub: [...item.on, ...item.kun.map(kunDisplay)].slice(0, 3).join('・'), meaning: item.meaning };
    case 'grammar':
      return { main: item.pattern, sub: '', meaning: item.meaning };
  }
}

export default function ReviewScreen() {
  const c = useColors();
  const now = useNow();
  const cards = useProgress((s) => s.data.cards);
  const days = useProgress((s) => s.data.days);
  const { sound, speechRate } = useSettings((s) => s.settings);

  const due = dueCount(cards, now);
  const tomorrow = dueCount(cards, now + DAY) - due;
  const week = dueCount(cards, now + 7 * DAY) - due;
  const learned = Object.keys(cards).length;
  const mastered = Object.values(cards).filter(isMastered).length;
  const accuracy = recentAccuracy(days, now);
  const weak = weakItems(cards, now, 15);

  return (
    <Screen title="複習" subtitle="在快要忘記的時候複習，記得最牢">
      <Card tone={due > 0 ? 'primary' : 'default'}>
        <View style={styles.dueRow}>
          <Txt size={48} weight="700" lang="latin" color={due > 0 ? 'primary' : 'textMuted'}>
            {due}
          </Txt>
          <View style={{ flex: 1 }}>
            <Txt variant="heading">{due > 0 ? '個項目該複習了' : '目前沒有到期的複習'}</Txt>
            <Txt variant="caption" color="textMuted">
              明天 +{tomorrow} · 7 天內 +{week}
            </Txt>
          </View>
        </View>
        <Button
          label={due > 0 ? '開始複習' : '提前練習弱項'}
          icon="review"
          variant={due > 0 ? 'primary' : 'secondary'}
          disabled={learned === 0}
          onPress={() => beginBlock({ type: 'review' })}
        />
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.stat}>
          <Txt size={22} weight="700" lang="latin">
            {learned}
          </Txt>
          <Txt variant="caption" color="textMuted">
            已學
          </Txt>
        </Card>
        <Card style={styles.stat}>
          <Txt size={22} weight="700" lang="latin">
            {mastered}
          </Txt>
          <Txt variant="caption" color="textMuted">
            熟練（記住 3 週以上）
          </Txt>
        </Card>
        <Card style={styles.stat}>
          <Txt size={22} weight="700" lang="latin">
            {accuracy === null ? '—' : `${Math.round(accuracy * 100)}%`}
          </Txt>
          <Txt variant="caption" color="textMuted">
            7 天答對率
          </Txt>
        </Card>
      </View>

      <Section title="容易忘記的" footer={weak.length === 0 ? '答錯過的項目會出現在這裡。' : sound ? '點一下聽發音。' : undefined}>
        {weak.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="trophy" size={28} color={c.textFaint} />
            <Txt color="textMuted">目前還沒有常錯的項目</Txt>
          </View>
        ) : (
          weak.map((item, i) => {
            const { main, sub, meaning } = label(item);
            return (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${main} ${meaning}`}
                  disabled={!sound}
                  onPress={() => void speak(speechFor(item), speechRate)}
                  style={({ pressed }) => [styles.weakRow, pressed && { opacity: 0.6 }]}>
                  <Txt lang="ja" size={20} weight="600">
                    {main}
                  </Txt>
                  {sub !== '' && (
                    <Txt lang="ja" color="textMuted">
                      {sub}
                    </Txt>
                  )}
                  <Txt color="textMuted" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                    {meaning}
                  </Txt>
                </Pressable>
              </View>
            );
          })
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  statsRow: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.md, paddingHorizontal: space.sm },
  empty: { alignItems: 'center', gap: space.sm, padding: space.xl },
  weakRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md },
});

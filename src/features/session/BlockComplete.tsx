import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { BlockFeedback } from '@/engine/adaptive';
import { currentStreak, dayKey } from '@/engine/progress';
import { summarize, type Session } from '@/engine/session';
import { notify } from '@/lib/confirm';
import { sendBlockFeedback, startBlock } from '@/state/actions';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { Button, Card, Dots, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

import { Footer } from './SessionParts';

function formatDuration(ms: number): string {
  const s = Math.max(1, Math.round(ms / 1000));
  return s < 60 ? `${s} 秒` : `${Math.floor(s / 60)} 分 ${s % 60} 秒`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt size={24} weight="700" lang="latin">
        {value}
      </Txt>
      <Txt variant="caption" color="textMuted">
        {label}
      </Txt>
    </View>
  );
}

export function BlockComplete({ session, onHome }: { session: Session; onHome: () => void }) {
  const c = useColors();
  const days = useProgress((s) => s.data.days);
  const dailyGoal = useSettings((s) => s.settings.dailyGoal);
  const [now] = useState(() => Date.now());
  const summary = summarize(session);
  const pct = Math.round(summary.accuracy * 100);
  const today = days[dayKey(now)]?.blocks ?? 0;
  const streak = currentStreak(days, now);

  const again = () => {
    if (!startBlock(session.mode)) notify('這個範圍已經學完了', '回首頁選擇其他內容，或到「課程」換一個程度。');
  };

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Txt lang="ja" size={34} weight="700" center>
            {pct >= 80 ? 'すごい！' : pct >= 50 ? 'お疲れさま！' : 'がんばろう！'}
          </Txt>
          <Txt color="textMuted" center>
            {pct >= 80 ? '太厲害了！' : pct >= 50 ? '辛苦了！' : '一起加油！'}完成了一個小節
          </Txt>
        </View>

        <Card>
          <View style={styles.stats}>
            <Stat value={summary.quizzes > 0 ? `${pct}%` : '—'} label="答對率" />
            <Stat value={String(summary.newItems)} label="新學" />
            <Stat value={String(summary.reviews)} label="複習" />
            <Stat value={formatDuration(summary.activeMs)} label="用時" />
          </View>
        </Card>

        <Card tone={today >= dailyGoal ? 'success' : 'default'}>
          <View style={styles.streakRow}>
            <Icon name="flame" size={26} color={c.accent} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt variant="heading">連續 {streak} 天</Txt>
              <Txt variant="caption" color="textMuted">
                {today >= dailyGoal ? '今天的目標達成了！' : `今日 ${today} / ${dailyGoal} 節`}
              </Txt>
            </View>
            <Dots value={Math.min(today, dailyGoal)} total={dailyGoal} />
          </View>
        </Card>

        <Card>
          <Txt variant="heading">這一節的難度覺得？</Txt>
          <Segmented<BlockFeedback | 'none'>
            options={[
              { label: '太簡單', value: 'easy' },
              { label: '剛剛好', value: 'ok' },
              { label: '太難', value: 'hard' },
            ]}
            value={session.feedback ?? 'none'}
            onChange={(v) => v !== 'none' && sendBlockFeedback(v)}
          />
          <Txt variant="caption" color="textMuted">
            {session.feedback === 'easy'
              ? '收到！接下來會出現更進階的內容。'
              : session.feedback === 'hard'
                ? '收到！接下來會放慢腳步，多一點複習。'
                : session.feedback === 'ok'
                  ? '好的，維持目前的步調。'
                  : '你的回饋會用來自動調整難度。'}
          </Txt>
        </Card>
      </ScrollView>
      <Footer>
        <Button variant="secondary" label="回首頁" onPress={onHome} style={{ flex: 1 }} />
        <Button label="再來一節" icon="play" onPress={again} style={{ flex: 1.4 }} />
      </Footer>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.xl },
  stats: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});

import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { TRAP_ITEMS } from '@/content';
import { overallLevel } from '@/engine/adaptive';
import { inKanaStage } from '@/engine/blockBuilder';
import { LEVEL_INFO } from '@/engine/levels';
import { currentStreak, dayKey, dueCount } from '@/engine/progress';
import { isComplete, remainingSteps } from '@/engine/session';
import { beginBlock as begin } from '@/features/beginBlock';
import { SoundToggle } from '@/features/session/SessionParts';
import { VoiceHint } from '@/features/VoiceHint';
import { useNow } from '@/state/hooks';
import { useProgress } from '@/state/progress';
import { useSession } from '@/state/session';
import { useSettings, type BlockMinutes } from '@/state/settings';
import { Button, Card, Dots, ProgressBar, Screen, Segmented } from '@/ui/controls';
import { Icon, type IconName } from '@/ui/Icon';
import { Ruby } from '@/ui/Ruby';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const WEEKDAYS = '日一二三四五六';

function dateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 星期${WEEKDAYS[d.getDay()]}`;
}

function StatTile({ icon, value, label, children }: { icon: IconName; value: string; label: string; children?: ReactNode }) {
  const c = useColors();
  return (
    <Card style={styles.stat}>
      <Icon name={icon} size={20} color={c.accent} />
      <Txt size={22} weight="700" lang="latin">
        {value}
      </Txt>
      <Txt variant="caption" color="textMuted">
        {label}
      </Txt>
      {children}
    </Card>
  );
}

function QuickAction({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Card onPress={onPress} style={styles.quick} accessibilityLabel={`${title}，${subtitle}`}>
      <View style={[styles.quickIcon, { backgroundColor: c.primarySoft }]}>
        <Icon name={icon} size={20} color={c.primary} />
      </View>
      <Txt variant="heading">{title}</Txt>
      <Txt variant="caption" color="textMuted">
        {subtitle}
      </Txt>
    </Card>
  );
}

export default function TodayScreen() {
  const now = useNow();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const data = useProgress((s) => s.data);
  const session = useSession((s) => s.session);

  const kanaStage = inKanaStage(data.ability, data.cards);
  const level = overallLevel(data.ability, kanaStage);
  const due = dueCount(data.cards, now);
  const blocksToday = data.days[dayKey(now)]?.blocks ?? 0;
  const streak = currentStreak(data.days, now);
  const resumable = session && !isComplete(session) ? session : null;
  const goalMet = blocksToday >= settings.dailyGoal;
  const tip = TRAP_ITEMS.length > 0 ? TRAP_ITEMS[Math.floor(now / 86_400_000) % TRAP_ITEMS.length] : undefined;

  return (
    <Screen
      title="スキマ日語"
      subtitle={`${dateLabel(now)} · 程度 ${LEVEL_INFO[level].label}（${settings.difficultyMode === 'auto' ? '自動' : '手動'}）`}
      right={<SoundToggle />}>
      <VoiceHint />
      {resumable ? (
        <Card tone="primary">
          <Txt variant="title">繼續上次的小節</Txt>
          <Txt color="textMuted">還剩 {remainingSteps(resumable)} 題 · 每答一題都會自動儲存</Txt>
          <ProgressBar value={resumable.index / resumable.steps.length} />
          <Button label="繼續" icon="play" onPress={() => router.push('/session')} />
          <Button variant="ghost" size="sm" label="改開始新的小節" onPress={() => begin({ type: 'smart' })} />
        </Card>
      ) : (
        <Card tone="primary">
          <Txt variant="title">{goalMet ? '今天的目標達成了！' : '今天的小節'}</Txt>
          <Txt color="textMuted">
            {kanaStage ? '從五十音開始，每次學幾個假名。' : '新內容 + 到期複習，隨時可以中斷。'}
          </Txt>
          <Button
            label={goalMet ? '再來一節' : '開始學習'}
            sublabel={`約 ${settings.blockMinutes} 分鐘`}
            icon="play"
            onPress={() => begin({ type: 'smart' })}
          />
          <Segmented<BlockMinutes>
            options={[
              { label: '1 分鐘', value: 1 },
              { label: '3 分鐘', value: 3 },
              { label: '5 分鐘', value: 5 },
            ]}
            value={settings.blockMinutes}
            onChange={(blockMinutes) => update({ blockMinutes })}
          />
        </Card>
      )}

      <View style={styles.statsRow}>
        <StatTile icon="flame" value={String(streak)} label="連續天數" />
        <StatTile icon="calendar" value={`${blocksToday}/${settings.dailyGoal}`} label="今日小節">
          <Dots value={Math.min(blocksToday, settings.dailyGoal)} total={settings.dailyGoal} />
        </StatTile>
        <StatTile icon="review" value={String(due)} label="待複習" />
      </View>

      <Txt variant="label" color="textMuted">
        快速開始
      </Txt>
      <View style={styles.grid}>
        <QuickAction
          icon="review"
          title="複習"
          subtitle={due > 0 ? `${due} 個到期` : Object.keys(data.cards).length > 0 ? '提前練習弱項' : '學過的內容會在這裡'}
          onPress={() => begin({ type: 'review' })}
        />
        <QuickAction icon="kana" title="五十音表" subtitle="查看與發音" onPress={() => router.push('/kana-chart')} />
        <QuickAction
          icon="warning"
          title="漢字陷阱"
          subtitle="中日同形異義"
          onPress={() => begin({ type: 'itemType', itemType: 'trap' })}
        />
        <QuickAction
          icon="chart"
          title={data.placementDone ? '重新測驗' : '程度測驗'}
          subtitle="約 2 分鐘"
          onPress={() => router.push('/placement')}
        />
      </View>

      {tip && (
        <Card tone="warning">
          <View style={styles.tipHeader}>
            <Icon name="lightbulb" size={18} />
            <Txt variant="label">今日漢字陷阱</Txt>
          </View>
          <Ruby text={tip.ruby} size={26} showRuby />
          <Txt>
            日文的意思是「<Txt weight="700">{tip.meaning}</Txt>」，不是「{tip.trap}」喔！
          </Txt>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  statsRow: { flexDirection: 'row', gap: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.md, paddingHorizontal: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  quick: { flexBasis: '46%', flexGrow: 1, gap: space.xs },
  quickIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

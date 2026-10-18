import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ITEM_COUNTS } from '@/content';
import { LEVELS, type ItemType, type Level } from '@/content/types';
import { overallLevel } from '@/engine/adaptive';
import { inKanaStage } from '@/engine/blockBuilder';
import { LEVEL_INFO } from '@/engine/levels';
import { levelProgress } from '@/engine/progress';
import { beginBlock } from '@/features/beginBlock';
import { useProgress } from '@/state/progress';
import { useSettings } from '@/state/settings';
import { Button, Card, Pill, ProgressBar, Screen, Segmented } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const TYPE_LABEL: Partial<Record<ItemType, string>> = { kana: '假名', vocab: '單字', kanji: '漢字', grammar: '文法' };

export default function CourseScreen() {
  const c = useColors();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const data = useProgress((s) => s.data);
  const progress = levelProgress(data.cards);
  const current = overallLevel(data.ability, inKanaStage(data.ability, data.cards));
  const trapTotal = LEVELS.reduce((sum, l) => sum + ITEM_COUNTS[l].trap, 0);
  const trapLearned = LEVELS.reduce((sum, l) => sum + progress[l].byType.trap.learned, 0);

  return (
    <Screen title="課程" subtitle="從五十音到 JLPT N1">
      <Card>
        <Txt variant="heading">難度調整</Txt>
        <Segmented<'auto' | 'manual'>
          options={[
            { label: '自動調整', value: 'auto' },
            { label: '自己選程度', value: 'manual' },
          ]}
          value={settings.difficultyMode}
          onChange={(difficultyMode) => update({ difficultyMode })}
        />
        {settings.difficultyMode === 'auto' ? (
          <Txt variant="caption" color="textMuted">
            目前推估程度：{LEVEL_INFO[current].label}。系統會依你的答題正確率、速度和「太簡單／太難」的回饋，自動挑選適合的新內容；太簡單的內容會自動跳過。
          </Txt>
        ) : (
          <>
            <Segmented<Level>
              options={LEVELS.map((level) => ({ label: LEVEL_INFO[level].label, value: level }))}
              value={settings.manualLevel}
              onChange={(manualLevel) => update({ manualLevel })}
            />
            <Txt variant="caption" color="textMuted">
              新內容只會從 {LEVEL_INFO[settings.manualLevel].label} 出題，學完才會往下一級。
            </Txt>
          </>
        )}
      </Card>

      {LEVELS.map((level) => {
        const row = progress[level];
        const info = LEVEL_INFO[level];
        const isCurrent = settings.difficultyMode === 'auto' ? level === current : level === settings.manualLevel;
        const parts = (Object.keys(TYPE_LABEL) as ItemType[])
          .filter((t) => row.byType[t].total > 0)
          .map((t) => `${TYPE_LABEL[t]} ${row.byType[t].learned}/${row.byType[t].total}`);
        return (
          <Card key={level} tone={isCurrent ? 'primary' : 'default'}>
            <View style={styles.levelHeader}>
              <View style={[styles.badge, { backgroundColor: isCurrent ? c.primary : c.surfaceAlt }]}>
                <Txt variant="label" lang="latin" style={{ color: isCurrent ? c.onPrimary : c.textMuted }}>
                  {info.label}
                </Txt>
              </View>
              <View style={{ flex: 1 }}>
                <Txt variant="heading">{info.title}</Txt>
                <Txt variant="caption" color="textMuted">
                  {info.desc}
                </Txt>
              </View>
              {isCurrent && <Pill label="目前" />}
            </View>
            <ProgressBar value={row.total > 0 ? row.learned / row.total : 0} color={isCurrent ? c.primary : c.textFaint} />
            <Txt variant="caption" color="textMuted">
              {parts.join(' · ')}
              {row.mastered > 0 ? ` · 熟練 ${row.mastered}` : ''}
            </Txt>
            <Button
              variant={isCurrent ? 'primary' : 'secondary'}
              size="md"
              label={`學 ${info.label}`}
              icon="play"
              onPress={() => beginBlock({ type: 'level', level })}
              disabled={row.total === 0}
            />
          </Card>
        );
      })}

      <Txt variant="label" color="textMuted">
        給中文母語者的特別單元
      </Txt>
      <Card>
        <View style={styles.levelHeader}>
          <Icon name="warning" size={22} color={c.accent} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">漢字陷阱</Txt>
            <Txt variant="caption" color="textMuted">
              中日同形異義詞：手紙是「信」、勉強是「讀書」……看起來懂，其實意思不一樣。
            </Txt>
          </View>
        </View>
        <ProgressBar value={trapTotal > 0 ? trapLearned / trapTotal : 0} color={c.accent} />
        <Button
          variant="secondary"
          size="md"
          label={`練習（${trapLearned}/${trapTotal}）`}
          icon="play"
          onPress={() => beginBlock({ type: 'itemType', itemType: 'trap' })}
        />
      </Card>
      <Card onPress={() => router.push('/kana-chart')} accessibilityLabel="五十音表">
        <View style={styles.levelHeader}>
          <Icon name="kana" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Txt variant="heading">五十音表</Txt>
            <Txt variant="caption" color="textMuted">
              平假名・片假名一覽，附字源與發音
            </Txt>
          </View>
          <Icon name="chevron" size={16} color={c.textFaint} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  badge: { minWidth: 48, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
});

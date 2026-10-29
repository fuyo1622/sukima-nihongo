import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ALL_ITEMS } from '@/content';
import { bestStreak, currentStreak, dayKey, totalMs } from '@/engine/progress';
import { BackupPaste } from '@/features/BackupPaste';
import { VoiceHint } from '@/features/VoiceHint';
import { canPickBackupFile, pickBackupFile, saveBackupFile } from '@/lib/backupFile';
import { confirmAsync, notify } from '@/lib/confirm';
import { webBuild } from '@/lib/webApp';
import { resetEverything } from '@/state/actions';
import { backupFileName, createBackup, describeBackup, parseBackup, restoreBackup } from '@/state/backup';
import { useNow } from '@/state/hooks';
import { useProgress } from '@/state/progress';
import { useSettings, type BlockMinutes } from '@/state/settings';
import { Card, ChoiceRow, Divider, Row, Screen, Section, SwitchRow } from '@/ui/controls';
import { space } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.stat}>
      <Txt size={22} weight="700" lang="latin">
        {value}
      </Txt>
      <Txt variant="caption" color="textMuted" center>
        {label}
      </Txt>
    </View>
  );
}

export default function MeScreen() {
  const now = useNow();
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const data = useProgress((s) => s.data);
  const minutes = Math.round(totalMs(data.days) / 60_000);

  const [pasting, setPasting] = useState(false);

  const reset = async () => {
    const ok = await confirmAsync('重設所有學習紀錄？', '所有進度、複習排程和統計都會被刪除，無法復原。', '重設', true);
    if (ok) {
      resetEverything();
      update({ onboarded: false });
      router.replace('/onboarding');
    }
  };

  // No await before saving or picking: browsers only share files or open the file picker right after a tap.
  const backup = () => {
    const file = createBackup();
    void saveBackupFile(backupFileName(file), JSON.stringify(file)).then((saved) => {
      if (saved) update({ lastBackupAt: file.createdAt });
    });
  };

  const restoreFrom = async (text: string | null) => {
    if (!text) return;
    const parsed = parseBackup(text);
    if ('error' in parsed) return notify('無法還原', parsed.error);
    const ok = await confirmAsync('從備份還原？', `${describeBackup(parsed.backup)}\n目前的學習紀錄會被這份備份取代。`, '還原', true);
    if (!ok) return;
    restoreBackup(parsed.backup);
    setPasting(false);
    notify('已還原', '學習紀錄已從備份還原。');
  };

  const restore = () => {
    if (canPickBackupFile) void pickBackupFile().then(restoreFrom);
    else setPasting(true);
  };

  return (
    <Screen title="我的">
      <Card>
        <View style={styles.stats}>
          <Stat value={String(currentStreak(data.days, now))} label="連續天數" />
          <Stat value={String(bestStreak(data.days))} label="最長連續" />
          <Stat value={`${Object.keys(data.cards).length}`} label={`已學 / ${ALL_ITEMS.length}`} />
          <Stat value={minutes < 60 ? `${minutes}分` : `${(minutes / 60).toFixed(1)}時`} label="總學習時間" />
        </View>
      </Card>

      <Section title="學習">
        <ChoiceRow<BlockMinutes>
          label="每節長度"
          detail="通勤一站、等紅燈、吃飯時都剛好"
          options={[
            { label: '1 分鐘', value: 1 },
            { label: '3 分鐘', value: 3 },
            { label: '5 分鐘', value: 5 },
          ]}
          value={settings.blockMinutes}
          onChange={(blockMinutes) => update({ blockMinutes })}
        />
        <Divider />
        <ChoiceRow
          label="每日目標"
          options={[1, 3, 5, 10].map((n) => ({ label: `${n} 節`, value: n }))}
          value={settings.dailyGoal}
          onChange={(dailyGoal) => update({ dailyGoal })}
        />
        <Divider />
        <SwitchRow label="學單字" value={settings.focus.vocab} onValueChange={(vocab) => update({ focus: { ...settings.focus, vocab } })} />
        <Divider />
        <SwitchRow label="學漢字" value={settings.focus.kanji} onValueChange={(kanji) => update({ focus: { ...settings.focus, kanji } })} />
        <Divider />
        <SwitchRow
          label="學文法"
          value={settings.focus.grammar}
          onValueChange={(grammar) => update({ focus: { ...settings.focus, grammar } })}
        />
        <Divider />
        <Row
          label="難度"
          value={settings.difficultyMode === 'auto' ? '自動調整' : `手動：${settings.manualLevel === 'kana' ? '入門' : settings.manualLevel}`}
          onPress={() => router.push('/course')}
        />
      </Section>

      <VoiceHint />
      <Section title="聲音" footer="靜音模式下不會出現聽力題，所有讀音都用假名顯示；有聲模式即使手機切成靜音也會播放。">
        <SwitchRow label="有聲模式" detail="戴耳機時開啟，會出現聽力題" value={settings.sound} onValueChange={(sound) => update({ sound })} />
        <Divider />
        <SwitchRow label="自動播放發音" value={settings.autoPlay} onValueChange={(autoPlay) => update({ autoPlay })} />
        <Divider />
        <ChoiceRow
          label="語速"
          options={[
            { label: '慢', value: 0.75 },
            { label: '正常', value: 1 },
          ]}
          value={settings.speechRate}
          onChange={(speechRate) => update({ speechRate })}
        />
      </Section>

      <Section title="顯示與操作">
        <SwitchRow label="假名標音" detail="在漢字上方顯示讀音" value={settings.furigana} onValueChange={(furigana) => update({ furigana })} />
        <Divider />
        <SwitchRow label="答對自動下一題" detail="單手操作更省力" value={settings.autoAdvance} onValueChange={(autoAdvance) => update({ autoAdvance })} />
        <Divider />
        <SwitchRow label="震動回饋" value={settings.haptics} onValueChange={(haptics) => update({ haptics })} />
      </Section>

      <Section
        title="資料"
        footer="App 更新時學習紀錄會自動保留。刪掉 App（包括主畫面上的網頁版）或換手機前，先備份一份，之後再還原。">
        <Row
          label="備份學習紀錄"
          detail={settings.lastBackupAt ? `上次備份：${dayKey(settings.lastBackupAt)}` : '存成一個檔案，還沒備份過'}
          onPress={backup}
        />
        <Divider />
        <Row label="從備份還原" detail={canPickBackupFile ? '選擇之前備份的檔案' : '貼上之前備份的內容'} onPress={restore} />
        <Divider />
        <Row label="重新做程度測驗" detail="約 2 分鐘，會重新估計你的程度" onPress={() => router.push('/placement')} />
        <Divider />
        <Row label="重設所有學習紀錄" destructive onPress={reset} />
      </Section>

      <Txt variant="caption" color="textMuted" center>
        スキマ日語 v{Constants.expoConfig?.version ?? '1.0.0'}
        {webBuild ? `（網頁版 ${webBuild.slice(0, 7)}）` : ''} · 學習紀錄存在這支手機上{'\n'}學習內容由 AI 協助編寫，持續校對中{'\n'}例句多數來自 Tatoeba（tatoeba.org，CC BY 2.0 FR），作者列在每個例句下方
      </Txt>
      <BackupPaste visible={pasting} onClose={() => setPasting(false)} onRestore={(text) => void restoreFrom(text)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stats: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
});

import { Platform, StyleSheet, View } from 'react-native';

import { openVoiceSettings } from '@/audio/speech';
import { useSettings } from '@/state/settings';
import { useVoice } from '@/state/voice';
import { Button, Card } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

const HOW_TO = Platform.select({
  android: '請在手機的「文字轉語音」設定中，替語音引擎（例如 Google 語音服務）下載「日文」語音資料，下載完回到這裡即可。',
  ios: '請到「設定 › 輔助使用 › 朗讀內容 › 聲音 › 日文」下載一個語音，下載完回到這裡即可。',
  default: '請換一個有日文語音的瀏覽器，或在電腦的語音設定中加入日文。',
});

/** Sound mode on a phone without a Japanese voice: explain why nothing plays and how to fix it. */
export function VoiceHint() {
  const c = useColors();
  const sound = useSettings((s) => s.settings.sound);
  const missing = useVoice((s) => s.status === 'missing');
  if (!sound || !missing) return null;
  return (
    <Card tone="warning" style={styles.card}>
      <View style={styles.title}>
        <Icon name="warning" size={20} color={c.warning} />
        <Txt variant="heading">找不到日文語音</Txt>
      </View>
      <Txt>暫時聽不到發音，聽力題也會先換成看的題目。{HOW_TO}</Txt>
      {Platform.OS === 'android' && <Button variant="secondary" size="md" icon="settings" label="開啟文字轉語音設定" onPress={openVoiceSettings} />}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  title: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

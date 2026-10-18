import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { stopSpeaking } from '@/audio/speech';
import { hapticTap } from '@/lib/haptics';
import { useSettings } from '@/state/settings';
import { useVoice } from '@/state/voice';
import { ProgressBar } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { radius, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** Sound on/off, always one tap away: switch to silent the moment the train gets quiet. */
export function SoundToggle() {
  const c = useColors();
  const sound = useSettings((s) => s.settings.sound);
  const haptics = useSettings((s) => s.settings.haptics);
  const update = useSettings((s) => s.update);
  const voiceMissing = useVoice((s) => s.status === 'missing');
  const noVoice = sound && voiceMissing;
  const fg = noVoice ? c.warning : sound ? c.primary : c.textMuted;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: sound }}
      accessibilityLabel={
        noVoice ? '有聲模式，但找不到日文語音，點一下切換成靜音' : sound ? '有聲模式，點一下切換成靜音' : '靜音模式，點一下切換成有聲'
      }
      hitSlop={8}
      onPress={() => {
        if (sound) stopSpeaking();
        if (haptics) hapticTap();
        update({ sound: !sound });
      }}
      style={({ pressed }) => [
        styles.soundChip,
        { backgroundColor: noVoice ? c.warningSoft : sound ? c.primarySoft : c.surfaceAlt, opacity: pressed ? 0.7 : 1 },
      ]}>
      <Icon name={noVoice ? 'warning' : sound ? 'soundOn' : 'soundOff'} size={16} color={fg} />
      <Txt variant="label" style={{ color: fg }}>
        {noVoice ? '無語音' : sound ? '有聲' : '靜音'}
      </Txt>
    </Pressable>
  );
}

export function SessionHeader({ progress, onClose }: { progress: number; onClose: () => void }) {
  const c = useColors();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="離開，進度已自動儲存"
        hitSlop={12}
        onPress={onClose}
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.5 : 1 }]}>
        <Icon name="close" size={22} color={c.textMuted} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <ProgressBar value={progress} color={c.accent} height={10} />
      </View>
      <SoundToggle />
    </View>
  );
}

/** Buttons pinned to the bottom of the screen, in thumb reach. */
export function Footer({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bg }]}>{children}</View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  close: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  soundChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  footer: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, borderTopWidth: StyleSheet.hairlineWidth },
});

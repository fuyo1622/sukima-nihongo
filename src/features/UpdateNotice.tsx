import { Pressable, StyleSheet, View } from 'react-native';

import { useAppUpdate } from '@/state/appUpdate';
import { Card } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** Once after the web app updated itself: the new version kept the learner's progress. */
export function UpdateNotice() {
  const c = useColors();
  const updated = useAppUpdate((s) => s.updated);
  const dismiss = useAppUpdate((s) => s.dismiss);
  if (!updated) return null;
  return (
    <Card tone="success" style={styles.card}>
      <Icon name="correct" size={20} color={c.success} />
      <View style={{ flex: 1 }}>
        <Txt variant="heading">已更新到最新版本</Txt>
        <Txt color="textMuted">你的學習紀錄都還在，可以接著學。</Txt>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="關閉" hitSlop={12} onPress={dismiss}>
        <Icon name="close" size={20} color={c.textMuted} />
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
});

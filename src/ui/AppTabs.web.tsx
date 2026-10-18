import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { dueCount } from '@/engine/progress';
import { useNow } from '@/state/hooks';
import { useProgress } from '@/state/progress';

import { Icon, type IconName } from './Icon';
import { MAX_WIDTH, radius, useColors } from './theme';
import { Txt } from './Txt';

/** Phone-style bottom tab bar for the web preview (the iOS app uses native tabs). */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home" label="今天" />
          </TabTrigger>
          <TabTrigger name="course" href="/course" asChild>
            <TabButton icon="course" label="課程" />
          </TabTrigger>
          <TabTrigger name="review" href="/review" asChild>
            <TabButton icon="review" label="複習" badge />
          </TabTrigger>
          <TabTrigger name="me" href="/me" asChild>
            <TabButton icon="me" label="我的" />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

function TabBar(props: TabListProps) {
  const c = useColors();
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View {...props} style={[styles.bar, { backgroundColor: c.surface, borderColor: c.border }]} />
    </View>
  );
}

function TabButton({ icon, label, badge, isFocused, ...props }: TabTriggerSlotProps & { icon: IconName; label: string; badge?: boolean }) {
  const c = useColors();
  const now = useNow();
  const due = useProgress((s) => (badge ? dueCount(s.data.cards, now) : 0));
  const color = isFocused ? c.primary : c.textFaint;
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: isFocused }} style={styles.button}>
      <View>
        <Icon name={icon} size={24} color={color} />
        {due > 0 && (
          <View style={[styles.badge, { backgroundColor: c.accent }]}>
            <Txt variant="caption" size={10} weight="700" style={{ color: c.onAccent }}>
              {due > 99 ? '99+' : due}
            </Txt>
          </View>
        )}
      </View>
      <Txt variant="caption" weight={isFocused ? '700' : '500'} style={{ color }}>
        {label}
      </Txt>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', padding: 12 },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MAX_WIDTH,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: 6,
    boxShadow: '0 6px 24px rgba(0, 0, 0, 0.08)',
  },
  button: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  badge: { position: 'absolute', top: -4, right: -12, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});

import { NativeTabs, type NativeTabsProps } from 'expo-router/unstable-native-tabs';
import { Platform } from 'react-native';

import { dueCount } from '@/engine/progress';
import { useNow } from '@/state/hooks';
import { useProgress } from '@/state/progress';

import { useColors, type Colors } from './theme';

/**
 * Android's Material tab bar defaults to wallpaper-derived (Material You) colours; use the app's own
 * palette instead. iOS keeps the system bar (Liquid Glass) and only takes the tint colour.
 */
function androidStyle(c: Colors): Partial<NativeTabsProps> {
  if (Platform.OS !== 'android') return {};
  return {
    backgroundColor: c.surface,
    indicatorColor: c.primarySoft,
    rippleColor: c.primarySoft,
    iconColor: { default: c.textMuted, selected: c.primary },
    labelStyle: { default: { color: c.textMuted }, selected: { color: c.primary, fontWeight: '700' } },
    badgeBackgroundColor: c.accent,
    badgeTextColor: c.onAccent,
  };
}

/** Native tab bar (UITabBarController on iOS, Material bottom navigation on Android). The web preview uses AppTabs.web.tsx. */
export default function AppTabs() {
  const c = useColors();
  const now = useNow();
  const due = useProgress((s) => dueCount(s.data.cards, now));
  return (
    <NativeTabs tintColor={c.primary} {...androidStyle(c)}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
        <NativeTabs.Trigger.Label>今天</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="course">
        <NativeTabs.Trigger.Icon sf={{ default: 'books.vertical', selected: 'books.vertical.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>課程</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="review">
        <NativeTabs.Trigger.Icon sf="arrow.triangle.2.circlepath" md="replay" />
        <NativeTabs.Trigger.Label>複習</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Badge hidden={due === 0}>{due > 99 ? '99+' : String(due)}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
        <NativeTabs.Trigger.Label>我的</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

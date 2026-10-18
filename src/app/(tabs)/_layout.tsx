import { Redirect } from 'expo-router';

import { useSettings } from '@/state/settings';
import AppTabs from '@/ui/AppTabs';

export default function TabsLayout() {
  const onboarded = useSettings((s) => s.settings.onboarded);
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <AppTabs />;
}

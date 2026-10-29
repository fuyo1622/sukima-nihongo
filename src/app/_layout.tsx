import '@/global.css';

import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { checkVoices } from '@/audio/speech';
import { keepStorage, webBuild } from '@/lib/webApp';
import { hydrateStores } from '@/state/actions';
import { noteBuild } from '@/state/appUpdate';
import { useSettings } from '@/state/settings';
import { FONT_ASSETS } from '@/ui/fonts';
import { useColors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [hydrated, setHydrated] = useState(false);
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  const sound = useSettings((s) => s.settings.sound);
  const scheme = useColorScheme();
  const c = useColors();
  // A font that fails to load falls back to the system font rather than blocking the app.
  const ready = hydrated && (fontsLoaded || fontError !== null);

  // Keep the splash screen up until saved progress (and any unfinished block) is loaded.
  useEffect(() => {
    hydrateStores()
      .then(() => {
        noteBuild(webBuild);
        keepStorage();
      })
      .catch((e) => console.warn('could not load saved data', e))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (fontError) console.warn('could not load fonts', fontError);
  }, [fontError]);

  // Find out early whether the phone can speak Japanese, and look again when the learner comes
  // back from installing a voice in system settings.
  useEffect(() => {
    if (!hydrated || !sound) return;
    void checkVoices();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkVoices();
    });
    return () => sub.remove();
  }, [hydrated, sound]);

  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // The window behind every screen, seen during Android transitions: keep it on the app background.
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(c.bg);
  }, [c.bg]);

  if (!ready) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: c.bg, card: c.surface, text: c.text, border: c.border, primary: c.primary },
  };

  return (
    <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="placement" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
        <Stack.Screen name="onboarding" options={{ animation: 'fade', gestureEnabled: false }} />
        <Stack.Screen name="kana-chart" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

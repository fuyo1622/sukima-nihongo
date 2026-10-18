import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { speak } from '@/audio/speech';
import type { Item } from '@/content/types';
import { speechFor } from '@/engine/exercises';
import { ItemIntro } from '@/features/quiz/ItemViews';
import { finishIntro } from '@/state/actions';
import { useSettings } from '@/state/settings';
import { Button } from '@/ui/controls';
import { space } from '@/ui/theme';

import { Footer } from './SessionParts';

/** Teaching card for a new item. "我已經會了" jumps straight to a quick check instead. */
export function IntroStep({ item }: { item: Item }) {
  const { sound, autoPlay, speechRate } = useSettings((s) => s.settings);
  const [shownAt] = useState(() => Date.now());

  useEffect(() => {
    if (sound && autoPlay) void speak(speechFor(item), speechRate);
  }, [item, sound, autoPlay, speechRate]);

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <ItemIntro item={item} />
      </ScrollView>
      <Footer>
        <Button
          variant="secondary"
          label="我已經會了"
          onPress={() => finishIntro(true, Date.now() - shownAt)}
          style={{ flex: 1 }}
        />
        <Button label="記住了" iconRight="next" onPress={() => finishIntro(false, Date.now() - shownAt)} style={{ flex: 1.4 }} />
      </Footer>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
});

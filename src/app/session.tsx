import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { BackHandler, View } from 'react-native';

import { stopSpeaking } from '@/audio/speech';
import { getItem } from '@/content';
import { currentStep, isComplete } from '@/engine/session';
import { BlockComplete } from '@/features/session/BlockComplete';
import { IntroStep } from '@/features/session/IntroStep';
import { QuestionStep } from '@/features/session/QuestionStep';
import { SessionHeader } from '@/features/session/SessionParts';
import { closeSession, nextStep } from '@/state/actions';
import { useSession } from '@/state/session';
import { ModalScreen } from '@/ui/controls';
import { MAX_WIDTH } from '@/ui/theme';

/** The learning block player (學習小節). Every answer is saved, so leaving at any point is safe. */
export default function SessionScreen() {
  const session = useSession((s) => s.session);
  const step = session ? currentStep(session) : undefined;
  const item = step ? getItem(step.itemId) : undefined;
  const complete = session ? isComplete(session) : false;

  const leave = useCallback(() => {
    stopSpeaking();
    if (complete) closeSession();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [complete]);

  // Android back button/gesture behaves like ✕: the block is already saved.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        leave();
        return true;
      });
      return () => sub.remove();
    }, [leave]),
  );

  // Content can change between app versions; skip steps whose item no longer exists.
  useEffect(() => {
    if (step && !item) nextStep();
  }, [step, item]);

  useEffect(() => stopSpeaking, []);

  if (!session) return <Redirect href="/" />;

  return (
    <ModalScreen>
      <View style={{ flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' }}>
        <SessionHeader progress={complete ? 1 : session.index / session.steps.length} onClose={leave} />
        {complete ? (
          <BlockComplete session={session} onHome={leave} />
        ) : step && item ? (
          step.role === 'intro' ? (
            <IntroStep key={`${session.id}:${step.id}`} item={item} />
          ) : (
            <QuestionStep key={`${session.id}:${step.id}`} step={step} item={item} />
          )
        ) : null}
      </View>
    </ModalScreen>
  );
}

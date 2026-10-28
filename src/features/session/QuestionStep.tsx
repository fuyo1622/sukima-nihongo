import { useEffect, useRef } from 'react';
import { AppState, ScrollView, StyleSheet, View } from 'react-native';

import { speak } from '@/audio/speech';
import type { Item } from '@/content/types';
import { playableKind, type Step } from '@/engine/exercises';
import { ItemSummary } from '@/features/quiz/ItemViews';
import { answerSpeech, OptionList, QuestionPrompt } from '@/features/quiz/Question';
import { hapticCorrect, hapticWrong } from '@/lib/haptics';
import { answerCurrent, nextStep } from '@/state/actions';
import { useSession } from '@/state/session';
import { useSettings } from '@/state/settings';
import { useVoice } from '@/state/voice';
import { Button, Card } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

import { readyToAdvance } from './advance';
import { Footer } from './SessionParts';

/** One multiple-choice question, then feedback with the answer card. */
export function QuestionStep({ step, item }: { step: Step; item: Item }) {
  const c = useColors();
  const settings = useSettings((s) => s.settings);
  const answer = useSession((s) => s.session?.answers[step.id]);
  const shownAt = useRef(0);
  // Bumped to cancel a pending automatic move to the next question.
  const advanceRun = useRef(0);
  const voiceMissing = useVoice((s) => s.status === 'missing');
  const kind = playableKind(step.kind, settings.sound && !voiceMissing);
  const revealed = answer !== undefined;

  useEffect(() => {
    shownAt.current = Date.now();
    // Time spent with the app in the background (a call, a locked phone) is not thinking
    // time: restart the clock when the learner comes back.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') shownAt.current = Date.now();
    });
    const run = advanceRun;
    return () => {
      sub.remove();
      run.current++;
    };
  }, []);

  const choose = (choice: number | null) => {
    if (revealed) return;
    const correct = answerCurrent(choice, Date.now() - shownAt.current);
    if (settings.haptics) (correct ? hapticCorrect : hapticWrong)();
    const speech = settings.sound && settings.autoPlay ? speak(answerSpeech(step, item), settings.speechRate) : undefined;
    // Correct answers move on by themselves once the answer has been heard, or has had time to be
    // read; mistakes wait for 繼續 so the answer card can be studied.
    if (correct && settings.autoAdvance) {
      const run = ++advanceRun.current;
      void readyToAdvance(speech).then(() => {
        if (run === advanceRun.current) nextStep();
      });
    }
  };

  const onContinue = () => {
    advanceRun.current++;
    nextStep();
  };

  return (
    <>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content}>
        <QuestionPrompt step={step} item={item} kind={kind} revealed={revealed} />
        <OptionList step={step} chosen={answer?.choice} revealed={revealed} onChoose={choose} />
        {revealed && (
          <Card tone={answer.correct ? 'success' : 'accent'} style={{ gap: space.md }}>
            <View style={styles.verdict}>
              <Icon name={answer.correct ? 'correct' : 'wrong'} size={24} color={answer.correct ? c.success : c.danger} />
              <Txt variant="heading" style={{ color: answer.correct ? c.success : c.danger }}>
                {answer.correct ? '答對了！' : answer.choice === null ? '沒關係，記住這個' : '答錯了，再看一次'}
              </Txt>
            </View>
            <ItemSummary item={item} quizIndex={typeof step.variant === 'number' ? step.variant : undefined} />
            {!answer.correct && step.role !== 'retry' && (
              <Txt variant="caption" color="textMuted">
                這一題會在小節最後再出現一次。
              </Txt>
            )}
          </Card>
        )}
      </ScrollView>
      <Footer>
        {revealed ? (
          <Button label="繼續" iconRight="next" onPress={onContinue} style={{ flex: 1 }} />
        ) : (
          <Button variant="ghost" size="md" label="不知道，看答案" onPress={() => choose(null)} style={{ flex: 1 }} />
        )}
      </Footer>
    </>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space.lg, gap: space.lg },
  verdict: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});

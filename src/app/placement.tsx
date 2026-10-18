import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getItem } from '@/content';
import { LEVEL_INFO } from '@/engine/levels';
import {
  answerPlacement,
  PLACEMENT_LENGTH,
  placementFinished,
  placementLevel,
  placementQuestion,
  startPlacement,
  type PlacementState,
} from '@/engine/placement';
import { OptionList, QuestionPrompt } from '@/features/quiz/Question';
import { Footer } from '@/features/session/SessionParts';
import { applyPlacement } from '@/state/actions';
import { useSettings } from '@/state/settings';
import { Button, Card, ModalScreen, ProgressBar } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { MAX_WIDTH, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** 程度測驗: a two-minute staircase test that sets the starting level. */
export default function PlacementScreen() {
  const c = useColors();
  const onboarded = useSettings((s) => s.settings.onboarded);
  const update = useSettings((s) => s.update);
  const [state, setState] = useState<PlacementState>(startPlacement);
  const [step, setStep] = useState(() => placementQuestion(startPlacement(), Math.random));
  const [chosen, setChosen] = useState<number | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const item = step ? getItem(step.itemId) : undefined;
  const question = !placementFinished(state) && step && item ? { step, item } : null;

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const choose = (choice: number | null) => {
    if (!step || chosen !== undefined) return;
    setChosen(choice);
    const next = answerPlacement(state, step.itemId, choice !== null && choice === step.answer);
    // A short pause so the learner sees the answer, then the next question.
    timer.current = setTimeout(() => {
      setState(next);
      setStep(placementFinished(next) ? null : placementQuestion(next, Math.random));
      setChosen(undefined);
    }, 700);
  };

  const close = useCallback(() => {
    if (onboarded) router.back();
    else router.replace('/onboarding');
  }, [onboarded]);

  // Android back: leave the test the same way as ✕ (back to onboarding if it started there).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        close();
        return true;
      });
      return () => sub.remove();
    }, [close]),
  );

  const accept = () => {
    applyPlacement(state.theta);
    update({ onboarded: true, manualLevel: placementLevel(state) });
    if (onboarded) router.back();
    else router.replace('/');
  };

  const level = placementLevel(state);
  return (
    <ModalScreen>
      <View style={styles.frame}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="離開測驗" hitSlop={12} onPress={close}>
            <Icon name="close" size={22} color={c.textMuted} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar value={state.answered / PLACEMENT_LENGTH} color={c.accent} height={10} />
          </View>
          <Txt variant="label" color="textMuted" lang="latin">
            {Math.min(state.answered + 1, PLACEMENT_LENGTH)}/{PLACEMENT_LENGTH}
          </Txt>
        </View>

        {!question ? (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.result}>
                <Txt color="textMuted">你的程度大約是</Txt>
                <Txt lang="latin" size={64} weight="700" color="primary">
                  {LEVEL_INFO[level].label}
                </Txt>
                <Txt variant="title">{LEVEL_INFO[level].title}</Txt>
                <Txt color="textMuted" center>
                  {LEVEL_INFO[level].desc}
                </Txt>
              </View>
              <Card tone="primary">
                <Txt>
                  答對 {state.correct} / {state.answered} 題。
                  {level === 'kana' ? '先從五十音開始打好基礎吧！' : '比這個程度簡單的內容會先跳過；學習時答錯較多，系統會自動補回基礎。'}
                </Txt>
              </Card>
            </ScrollView>
            <Footer>
              <Button label="從這裡開始學" iconRight="next" onPress={accept} style={{ flex: 1 }} />
            </Footer>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={[styles.content, { flexGrow: 1 }]}>
              <QuestionPrompt step={question.step} item={question.item} kind={question.step.kind} revealed={chosen !== undefined} />
              <OptionList step={question.step} chosen={chosen} revealed={chosen !== undefined} onChoose={choose} />
            </ScrollView>
            <Footer>
              <Button
                variant="ghost"
                size="md"
                label="不知道，跳過"
                disabled={chosen !== undefined}
                onPress={() => choose(null)}
                style={{ flex: 1 }}
              />
            </Footer>
          </>
        )}
      </View>
    </ModalScreen>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  content: { padding: space.lg, gap: space.lg },
  result: { alignItems: 'center', gap: space.xs, paddingVertical: space.xxl },
});

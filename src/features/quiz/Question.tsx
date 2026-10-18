import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { speak } from '@/audio/speech';
import { rubyBase } from '@/content/text';
import { BLANK, POS_LABEL, type Item } from '@/content/types';
import { instruction, LISTENING_KINDS, speechFor, type ExerciseKind, type Step } from '@/engine/exercises';
import { useSettings } from '@/state/settings';
import { Pill } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Ruby } from '@/ui/Ruby';
import { radius, space, useColors, type Lang } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** What to pronounce once a question is answered. */
export function answerSpeech(step: Step, item: Item): string {
  if (item.type === 'grammar') {
    const quiz = item.quizzes[typeof step.variant === 'number' ? step.variant : 0];
    return quiz ? rubyBase(quiz.ja).replace(BLANK, quiz.answer) : speechFor(item);
  }
  if (step.kind === 'kanji_reading' && step.options && step.answer !== undefined) return step.options[step.answer];
  return speechFor(item);
}

function ListenPrompt({ text }: { text: string }) {
  const c = useColors();
  const rate = useSettings((s) => s.settings.speechRate);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="再聽一次"
      onPress={() => void speak(text, rate)}
      style={({ pressed }) => [styles.listen, { backgroundColor: c.primarySoft, borderColor: c.primary, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name="soundOn" size={44} color={c.primary} />
      <Txt variant="caption" color="primary" weight="600">
        點一下再聽一次
      </Txt>
    </Pressable>
  );
}

/** The question itself: instruction plus the thing being asked about. */
export function QuestionPrompt({ step, item, kind, revealed }: { step: Step; item: Item; kind: ExerciseKind; revealed: boolean }) {
  const { furigana, sound, speechRate } = useSettings((s) => s.settings);

  // Listening questions play as soon as they appear.
  useEffect(() => {
    if (sound && LISTENING_KINDS.has(kind)) void speak(speechFor(item), speechRate);
  }, [kind, item, sound, speechRate]);

  let body: ReactNode;
  switch (kind) {
    case 'kana_listen':
    case 'vocab_listen':
      body = revealed ? (
        item.type === 'kana' ? (
          <Txt lang="ja" size={72}>
            {item.kana}
          </Txt>
        ) : item.type === 'vocab' ? (
          <Ruby text={item.ruby} size={38} showRuby center />
        ) : null
      ) : (
        <ListenPrompt text={speechFor(item)} />
      );
      break;
    case 'kana_read':
      body = item.type === 'kana' && (
        <Txt lang="ja" size={104}>
          {item.kana}
        </Txt>
      );
      break;
    case 'kana_pick':
      body = item.type === 'kana' && (
        <Txt lang="latin" size={60} weight="700" color="primary">
          {item.romaji}
        </Txt>
      );
      break;
    case 'vocab_meaning':
    case 'vocab_reading':
      body = item.type === 'vocab' && (
        <Ruby text={item.ruby} size={42} showRuby={revealed || (kind === 'vocab_meaning' && furigana)} center />
      );
      break;
    case 'vocab_word':
      body = item.type === 'vocab' && (
        <View style={styles.center}>
          <Txt size={30} weight="700" center>
            {item.meaning}
          </Txt>
          <Pill label={POS_LABEL[item.pos]} tone="muted" />
        </View>
      );
      break;
    case 'kanji_meaning':
    case 'kanji_reading':
    case 'kanji_form':
      body = item.type === 'kanji' && (
        <View style={styles.center}>
          <Txt lang="ja" size={104} style={{ lineHeight: 124 }}>
            {item.kanji}
          </Txt>
          {kind === 'kanji_reading' && <Pill label={step.variant === 'kun' ? '訓讀' : '音讀'} />}
        </View>
      );
      break;
    case 'grammar_cloze': {
      const quiz = item.type === 'grammar' ? item.quizzes[typeof step.variant === 'number' ? step.variant : 0] : undefined;
      body = quiz && (
        <View style={{ gap: space.md, width: '100%' }}>
          <Ruby text={quiz.ja} size={24} showRuby={furigana} fill={revealed ? quiz.answer : undefined} />
          {quiz.zh && <Txt color="textMuted">{quiz.zh}</Txt>}
        </View>
      );
      break;
    }
    case 'trap_meaning':
      body = item.type === 'trap' && (
        <View style={styles.center}>
          <Ruby text={item.ruby} size={42} showRuby center />
          <Pill label="中日同形異義" tone="accent" icon="warning" />
        </View>
      );
      break;
    case 'intro':
      body = null;
  }

  return (
    <View style={styles.prompt}>
      <Txt variant="label" color="textMuted" center>
        {instruction(kind, step.variant)}
      </Txt>
      <View style={styles.promptBody}>{body}</View>
    </View>
  );
}

type OptionState = 'idle' | 'correct' | 'wrong' | 'dim';

function OptionButton({
  label,
  lang,
  size,
  state,
  compact,
  onPress,
}: {
  label: string;
  lang: Lang;
  size: number;
  state: OptionState;
  compact: boolean;
  onPress: () => void;
}) {
  const c = useColors();
  const tone = {
    idle: { bg: c.surface, border: c.border, fg: c.text },
    correct: { bg: c.successSoft, border: c.success, fg: c.success },
    wrong: { bg: c.dangerSoft, border: c.danger, fg: c.danger },
    dim: { bg: c.surface, border: c.border, fg: c.textFaint },
  }[state];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: state !== 'idle', selected: state === 'wrong' || state === 'correct' }}
      disabled={state !== 'idle'}
      onPress={onPress}
      android_ripple={{ color: c.primarySoft }}
      style={({ pressed }) => [
        styles.option,
        compact ? styles.optionCompact : styles.optionWide,
        { backgroundColor: tone.bg, borderColor: tone.border, borderWidth: state === 'idle' || state === 'dim' ? 1 : 2 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.85 },
      ]}>
      <Txt lang={lang} size={size} weight={state === 'correct' ? '700' : '500'} center={compact} style={{ color: tone.fg, flexShrink: 1 }}>
        {label}
      </Txt>
      {state === 'correct' && <Icon name="correct" size={22} color={c.success} />}
      {state === 'wrong' && <Icon name="wrong" size={22} color={c.danger} />}
    </Pressable>
  );
}

/** Answer options. Short options (kana, romaji, single kanji) get a 2×2 grid; longer ones a list. */
export function OptionList({
  step,
  chosen,
  revealed,
  onChoose,
}: {
  step: Step;
  chosen: number | null | undefined;
  revealed: boolean;
  onChoose: (index: number) => void;
}) {
  const options = step.options ?? [];
  const compact = options.every((o) => [...o].length <= 4);
  const lang: Lang = step.script === 'ja' ? 'ja' : step.script === 'latin' ? 'latin' : 'zh';
  const size = compact ? (lang === 'latin' ? 24 : 30) : lang === 'ja' ? 21 : 17;
  return (
    <View style={compact ? styles.grid : styles.list}>
      {options.map((option, i) => {
        const state: OptionState = !revealed ? 'idle' : i === step.answer ? 'correct' : i === chosen ? 'wrong' : 'dim';
        return (
          <OptionButton
            key={`${i}-${option}`}
            label={option}
            lang={lang}
            size={size}
            state={state}
            compact={compact}
            onPress={() => onChoose(i)}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { flexGrow: 1, gap: space.lg, justifyContent: 'center', paddingVertical: space.md },
  promptBody: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },
  center: { alignItems: 'center', gap: space.sm },
  listen: { width: 148, height: 148, borderRadius: 74, borderWidth: 2, alignItems: 'center', justifyContent: 'center', gap: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  list: { gap: space.sm + 2 },
  option: { borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, overflow: 'hidden' },
  optionCompact: { flexBasis: '46%', flexGrow: 1, minHeight: 72, justifyContent: 'center', paddingHorizontal: space.md },
  optionWide: { minHeight: 56, paddingHorizontal: space.lg, paddingVertical: space.md, justifyContent: 'space-between' },
});

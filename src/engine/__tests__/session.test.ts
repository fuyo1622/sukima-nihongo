import { abilityForLevel } from '../adaptive';
import { buildBlock } from '../blockBuilder';
import { mulberry32 } from '../random';
import {
  advance,
  answerStep,
  createSession,
  currentStep,
  isComplete,
  MAX_RETRIES,
  remainingSteps,
  summarize,
  testOut,
  type Session,
} from '../session';

const NOW = new Date(2026, 8, 24, 8, 0).getTime();

function newSession(): Session {
  const steps = buildBlock({
    mode: { type: 'smart' },
    size: 10,
    now: NOW,
    cards: {},
    ability: abilityForLevel('N5'),
    sound: false,
    difficultyMode: 'auto',
    manualLevel: 'N5',
    focus: { vocab: true, kanji: true, grammar: true },
    rng: mulberry32(3),
  });
  return createSession('test', { type: 'smart' }, steps, NOW);
}

/** Answers the current step (correctly unless `wrong`) and moves on. */
function play(s: Session, wrong = false): Session {
  const step = currentStep(s)!;
  const correct = step.role === 'intro' ? true : !wrong;
  const choice = step.answer === undefined ? null : correct ? step.answer : (step.answer + 1) % step.options!.length;
  const answered = answerStep(s, step.id, { choice, correct, ms: 2000, at: NOW });
  return advance(answered, NOW, mulberry32(5));
}

describe('session', () => {
  it('runs a block to completion', () => {
    let s = newSession();
    const total = s.steps.length;
    for (let i = 0; i < total; i++) s = play(s);
    expect(isComplete(s)).toBe(true);
    expect(s.completedAt).toBe(NOW);
    const summary = summarize(s);
    expect(summary.accuracy).toBe(1);
    expect(summary.newItems + summary.reviews).toBe(summary.quizzes);
  });

  it('re-asks missed questions at the end, at most MAX_RETRIES times', () => {
    let s = newSession();
    const base = s.steps.length;
    while (!isComplete(s)) s = play(s, true);
    const quizzes = s.steps.slice(0, base).filter((st) => st.role !== 'intro').length;
    expect(s.steps.length).toBe(base + Math.min(quizzes, MAX_RETRIES));
    expect(s.steps.slice(base).every((st) => st.role === 'retry')).toBe(true);
    expect(summarize(s).accuracy).toBe(0);
  });

  it('survives being saved and restored mid-block', () => {
    let s = newSession();
    s = play(s);
    s = play(s);
    const restored = JSON.parse(JSON.stringify(s)) as Session;
    expect(restored.index).toBe(2);
    expect(remainingSteps(restored)).toBe(s.steps.length - 2);
    expect(currentStep(restored)).toEqual(currentStep(s));
  });

  it('keeps the first answer to a step', () => {
    const s = newSession();
    const step = currentStep(s)!;
    const once = answerStep(s, step.id, { choice: 0, correct: true, ms: 1, at: NOW });
    const twice = answerStep(once, step.id, { choice: 1, correct: false, ms: 1, at: NOW });
    expect(twice.answers[step.id].correct).toBe(true);
  });

  it('tests out an intro by asking its check right away', () => {
    const s = newSession();
    const intro = s.steps.find((st) => st.role === 'intro')!;
    const introIndex = s.steps.indexOf(intro);
    const next = testOut(s, intro.id, NOW);
    expect(next.answers[intro.id].testedOut).toBe(true);
    expect(next.steps[introIndex + 1]).toMatchObject({ itemId: intro.itemId, role: 'check' });
    expect(next.steps).toHaveLength(s.steps.length);
  });
});

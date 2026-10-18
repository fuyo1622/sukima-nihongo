/**
 * User actions that touch more than one store. Screens call these; the engine does the math.
 */
import type { Level } from '@/content/types';
import { abilityForLevel, abilityFromTheta, type BlockFeedback } from '@/engine/adaptive';
import { BLOCK_SIZES, buildBlock, type BlockMode } from '@/engine/blockBuilder';
import { applyAnswer, completeBlock, giveFeedback } from '@/engine/progress';
import { randomId } from '@/engine/random';
import {
  advance,
  answerStep,
  createSession,
  currentStep,
  summarize,
  testedOut,
  testOut,
  type Session,
} from '@/engine/session';

import { useProgress } from './progress';
import { useSession } from './session';
import { useSettings, type BlockMinutes } from './settings';
import { useVoice } from './voice';

/** Builds a new block and makes it the current session. Returns false when there is nothing to study. */
export function startBlock(mode: BlockMode, minutes?: BlockMinutes): boolean {
  const { settings } = useSettings.getState();
  const { data } = useProgress.getState();
  const now = Date.now();
  const steps = buildBlock({
    mode,
    size: BLOCK_SIZES[minutes ?? settings.blockMinutes],
    now,
    cards: data.cards,
    ability: data.ability,
    sound: settings.sound && useVoice.getState().status !== 'missing',
    difficultyMode: settings.difficultyMode,
    manualLevel: settings.manualLevel,
    focus: settings.focus,
    rng: Math.random,
  });
  if (steps.length === 0) return false;
  useSession.getState().set(createSession(randomId(), mode, steps, now));
  return true;
}

/** Answers the current quiz step. `choice` null means "不知道". Returns whether it was correct. */
export function answerCurrent(choice: number | null, ms: number): boolean {
  const session = useSession.getState().session;
  const step = session && currentStep(session);
  if (!session || !step || session.answers[step.id]) return false;
  const now = Date.now();
  const correct = choice !== null && choice === step.answer;
  const next = answerStep(session, step.id, { choice, correct, ms, at: now });
  useSession.getState().set(next);
  const progress = useProgress.getState();
  progress.commit(applyAnswer(progress.data, step, next.answers[step.id], testedOut(next, step.itemId), now));
  return correct;
}

/** Leaves an intro card. `knowIt` = "我已經會了": the item's check is asked right away. */
export function finishIntro(knowIt: boolean, ms: number): void {
  const session = useSession.getState().session;
  const step = session && currentStep(session);
  if (!session || !step || step.role !== 'intro') return;
  const now = Date.now();
  const seen = knowIt
    ? testOut(session, step.id, now)
    : answerStep(session, step.id, { choice: null, correct: true, ms, at: now });
  goNext(seen, now);
}

/** Moves past an answered question. */
export function nextStep(): void {
  const session = useSession.getState().session;
  if (session) goNext(session, Date.now());
}

function goNext(session: Session, now: number): void {
  const next = advance(session, now, Math.random);
  useSession.getState().set(next);
  if (!session.completedAt && next.completedAt) {
    const progress = useProgress.getState();
    progress.commit(completeBlock(progress.data, now));
  }
}

/** End-of-block "太簡單 / 剛剛好 / 太難". */
export function sendBlockFeedback(feedback: BlockFeedback): void {
  const session = useSession.getState().session;
  if (!session || session.feedback) return;
  useSession.getState().set({ ...session, feedback });
  const progress = useProgress.getState();
  progress.commit(giveFeedback(progress.data, summarize(session).skills, feedback));
}

export function closeSession(): void {
  useSession.getState().set(null);
}

/** Starting point chosen during onboarding (or when changing level by hand). */
export function setStartingLevel(level: Level): void {
  const progress = useProgress.getState();
  progress.commit({ ...progress.data, ability: abilityForLevel(level) });
}

export function applyPlacement(theta: number): void {
  const progress = useProgress.getState();
  progress.commit({ ...progress.data, ability: abilityFromTheta(theta), placementDone: true });
}

export function resetEverything(): void {
  useSession.getState().set(null);
  useProgress.getState().reset();
}

export async function hydrateStores(): Promise<void> {
  await Promise.all([
    useSettings.getState().hydrate(),
    useProgress.getState().hydrate(),
    useSession.getState().hydrate(),
  ]);
}

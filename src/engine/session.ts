import { getItem, skillOf } from '../content';
import type { Skill } from '../content/types';
import type { BlockFeedback } from './adaptive';
import type { BlockMode } from './blockBuilder';
import { reshuffled, type Step } from './exercises';
import type { Rng } from './random';

/**
 * A learning block in progress. It is saved after every answer, so closing the app,
 * taking a call or getting off the train never loses more than the current question.
 */
export interface Session {
  v: 1;
  id: string;
  mode: BlockMode;
  createdAt: number;
  updatedAt: number;
  steps: Step[];
  /** Index of the step on screen. */
  index: number;
  answers: Record<string, Answer>;
  retries: number;
  completedAt?: number;
  feedback?: BlockFeedback;
}

export interface Answer {
  /** Chosen option, or null for "不知道" / an intro card. */
  choice: number | null;
  correct: boolean;
  ms: number;
  at: number;
  /** Intro card answered with "我已經會了". */
  testedOut?: boolean;
}

export const MAX_RETRIES = 3;
/** Time on a single question beyond this is treated as the learner having looked away. */
export const MAX_ACTIVE_MS = 60_000;

export function createSession(id: string, mode: BlockMode, steps: Step[], now: number): Session {
  return { v: 1, id, mode, createdAt: now, updatedAt: now, steps, index: 0, answers: {}, retries: 0 };
}

export function currentStep(s: Session): Step | undefined {
  return s.steps[s.index];
}

export function isComplete(s: Session): boolean {
  return s.index >= s.steps.length;
}

export function remainingSteps(s: Session): number {
  return Math.max(0, s.steps.length - s.index);
}

/** Records an answer. The first answer to a step is final. */
export function answerStep(s: Session, stepId: string, answer: Answer): Session {
  if (s.answers[stepId]) return s;
  return { ...s, answers: { ...s.answers, [stepId]: answer }, updatedAt: answer.at };
}

/**
 * "我已經會了" on an intro card: mark it, and move the item's check right after the intro
 * so the claim is verified immediately.
 */
export function testOut(s: Session, stepId: string, now: number): Session {
  const introIndex = s.steps.findIndex((step) => step.id === stepId);
  if (introIndex < 0 || s.answers[stepId]) return s;
  const itemId = s.steps[introIndex].itemId;
  const checkIndex = s.steps.findIndex((step, i) => i > introIndex && step.itemId === itemId && step.role === 'check');
  let steps = s.steps;
  if (checkIndex > introIndex + 1) {
    steps = s.steps.slice();
    const [check] = steps.splice(checkIndex, 1);
    steps.splice(introIndex + 1, 0, check);
  }
  return {
    ...s,
    steps,
    answers: { ...s.answers, [stepId]: { choice: null, correct: true, ms: 0, at: now, testedOut: true } },
    updatedAt: now,
  };
}

export function testedOut(s: Session, itemId: string): boolean {
  return s.steps.some((step) => step.itemId === itemId && step.role === 'intro' && s.answers[step.id]?.testedOut);
}

/** Moves on; a missed quiz is asked again at the end of the block (at most MAX_RETRIES times). */
export function advance(s: Session, now: number, rng: Rng): Session {
  const step = s.steps[s.index];
  const answer = step ? s.answers[step.id] : undefined;
  let steps = s.steps;
  let retries = s.retries;
  if (step && answer && !answer.correct && step.role !== 'intro' && step.role !== 'retry' && retries < MAX_RETRIES) {
    steps = [...steps, reshuffled(step, `${step.id}r`, rng)];
    retries += 1;
  }
  const index = Math.min(s.index + 1, steps.length);
  const done = index >= steps.length;
  return { ...s, steps, retries, index, updatedAt: now, completedAt: done ? (s.completedAt ?? now) : s.completedAt };
}

export interface SessionSummary {
  quizzes: number;
  correct: number;
  accuracy: number;
  newItems: number;
  reviews: number;
  activeMs: number;
  skills: Skill[];
}

export function summarize(s: Session): SessionSummary {
  let quizzes = 0;
  let correct = 0;
  let newItems = 0;
  let reviews = 0;
  let activeMs = 0;
  const skills = new Set<Skill>();
  for (const step of s.steps) {
    const answer = s.answers[step.id];
    if (!answer) continue;
    activeMs += Math.min(answer.ms, MAX_ACTIVE_MS);
    const item = getItem(step.itemId);
    if (item) skills.add(skillOf(item.type));
    if (step.role === 'check' || step.role === 'review') {
      quizzes += 1;
      if (answer.correct) correct += 1;
      if (step.role === 'check') newItems += 1;
      else reviews += 1;
    }
  }
  return {
    quizzes,
    correct,
    accuracy: quizzes > 0 ? correct / quizzes : 0,
    newItems,
    reviews,
    activeMs,
    skills: [...skills],
  };
}

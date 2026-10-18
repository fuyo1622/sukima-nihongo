import type { Level, Skill } from '../content/types';
import { LEVEL_BANDS, levelForTheta } from './levels';

/**
 * Learner ability per skill (θ, same 0–1000 scale as item difficulty), updated Elo-style
 * after every graded answer. `pace` scales how many new items a block introduces.
 */
export interface Ability {
  theta: Record<Skill, number>;
  n: Record<Skill, number>;
  pace: number;
}

/** θ for kana at or above this means kana are finished (or skipped by a placement). */
export const KANA_DONE = LEVEL_BANDS.kana[1];
const KANA_SKIPPED = 400;

/**
 * New items are chosen easiest-first, but never below θ − WINDOW_BELOW: a learner who
 * keeps answering well moves θ up and silently skips material that is too easy for them.
 */
export const WINDOW_BELOW = 120;

const zero = (): Record<Skill, number> => ({ kana: 0, vocab: 0, kanji: 0, grammar: 0 });

function clamp(x: number, lo = 0, hi = 1000): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Starting ability when the learner tells us their level. */
export function abilityForLevel(level: Level): Ability {
  if (level === 'kana') {
    const start = LEVEL_BANDS.N5[0] + WINDOW_BELOW;
    return { theta: { kana: 0, vocab: start, kanji: start, grammar: start }, n: zero(), pace: 1 };
  }
  // Put θ one window above the band start so the first new items are the level's easiest.
  const t = clamp(LEVEL_BANDS[level][0] + WINDOW_BELOW);
  return { theta: { kana: KANA_SKIPPED, vocab: t, kanji: t, grammar: t }, n: zero(), pace: 1 };
}

/** Ability from a placement-test estimate. */
export function abilityFromTheta(theta: number): Ability {
  if (theta < KANA_DONE) return abilityForLevel('kana');
  const t = clamp(theta);
  return { theta: { kana: KANA_SKIPPED, vocab: t, kanji: t, grammar: t }, n: zero(), pace: 1 };
}

export const DEFAULT_ABILITY: Ability = abilityForLevel('kana');

const SCALE = 60;
/** Items right at θ are expected to be answered correctly ~70% of the time after teaching. */
const OFFSET = 50;

export function expectedScore(theta: number, d: number): number {
  return 1 / (1 + Math.exp(-(theta - d + OFFSET) / SCALE));
}

/**
 * Elo update. `score` is 1 (correct), ~0.7 (correct but slow) or 0 (wrong). The step size
 * shrinks as we observe more answers, so early estimates move fast and later ones settle.
 */
export function updateAbility(a: Ability, skill: Skill, d: number, score: number, weight = 1): Ability {
  const n = a.n[skill];
  const k = weight * Math.max(10, 48 / Math.sqrt(1 + n / 8));
  const theta = clamp(a.theta[skill] + k * (score - expectedScore(a.theta[skill], d)));
  return { ...a, theta: { ...a.theta, [skill]: theta }, n: { ...a.n, [skill]: n + 1 } };
}

export type BlockFeedback = 'easy' | 'ok' | 'hard';

/** End-of-block "too easy / just right / too hard" button. */
export function applyFeedback(a: Ability, skills: readonly Skill[], feedback: BlockFeedback): Ability {
  if (feedback === 'ok') return a;
  const delta = feedback === 'easy' ? 40 : -40;
  const theta = { ...a.theta };
  for (const skill of new Set(skills)) {
    if (skill === 'kana') continue;
    theta[skill] = clamp(theta[skill] + delta);
  }
  const pace = clamp(a.pace + (feedback === 'easy' ? 0.15 : -0.2), 0.5, 1.5);
  return { ...a, theta, pace };
}

/** Overall level shown in the UI. */
export function overallLevel(a: Ability, kanaStage: boolean): Level {
  if (kanaStage) return 'kana';
  const avg = (a.theta.vocab + a.theta.kanji + a.theta.grammar) / 3;
  return levelForTheta(Math.max(avg, LEVEL_BANDS.N5[0]));
}

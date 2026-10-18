import { ALL_ITEMS, getItem, skillOf } from '../content';
import { ITEM_TYPES, LEVELS, type Item, type ItemType, type Level, type Skill } from '../content/types';
import { applyFeedback, DEFAULT_ABILITY, updateAbility, type Ability, type BlockFeedback } from './adaptive';
import { SLOW_MS, type Step } from './exercises';
import type { Answer } from './session';
import { gradeFor, isMastered, isSlow, retrievability, reviewCard, State, type CardState } from './srs';

export interface DayStat {
  blocks: number;
  answers: number;
  correct: number;
  newItems: number;
  ms: number;
}

/** Everything the learner has done. Persisted (sharded) by the progress store. */
export interface ProgressData {
  v: 1;
  cards: Record<string, CardState>;
  ability: Ability;
  /** Keyed by local date, YYYY-MM-DD. */
  days: Record<string, DayStat>;
  placementDone: boolean;
}

export function emptyProgress(ability: Ability = DEFAULT_ABILITY): ProgressData {
  return { v: 1, cards: {}, ability, days: {}, placementDone: false };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function addDay(days: Record<string, DayStat>, key: string, delta: Partial<DayStat>): Record<string, DayStat> {
  const cur = days[key] ?? { blocks: 0, answers: 0, correct: 0, newItems: 0, ms: 0 };
  return {
    ...days,
    [key]: {
      blocks: cur.blocks + (delta.blocks ?? 0),
      answers: cur.answers + (delta.answers ?? 0),
      correct: cur.correct + (delta.correct ?? 0),
      newItems: cur.newItems + (delta.newItems ?? 0),
      ms: cur.ms + (delta.ms ?? 0),
    },
  };
}

/** Applies one answered step: schedules the item, updates ability and today's stats. */
export function applyAnswer(p: ProgressData, step: Step, answer: Answer, testedOut: boolean, now: number): ProgressData {
  if (step.role === 'intro') return p;
  const item = getItem(step.itemId);
  if (!item) return p;
  const slow = isSlow(answer.ms, SLOW_MS[step.kind]);
  const days = addDay(p.days, dayKey(now), {
    answers: 1,
    correct: answer.correct ? 1 : 0,
    newItems: step.role === 'check' ? 1 : 0,
    ms: Math.min(answer.ms, 60_000),
  });
  // A re-asked question is practice only; the first attempt already set the schedule.
  if (step.role === 'retry') return { ...p, days };

  const card = reviewCard(p.cards[item.id], gradeFor(answer.correct, answer.ms, SLOW_MS[step.kind], testedOut), now);
  const score = answer.correct ? (slow ? 0.7 : 1) : 0;
  // First encounters say the most about level; reviews mostly measure memory.
  const weight = step.role === 'check' ? (testedOut ? 1.5 : 1) : 0.5;
  const ability = updateAbility(p.ability, skillOf(item.type), item.d, score, weight);
  return { ...p, cards: { ...p.cards, [item.id]: card }, ability, days };
}

export function completeBlock(p: ProgressData, now: number): ProgressData {
  return { ...p, days: addDay(p.days, dayKey(now), { blocks: 1 }) };
}

export function giveFeedback(p: ProgressData, skills: readonly Skill[], feedback: BlockFeedback): ProgressData {
  return { ...p, ability: applyFeedback(p.ability, skills, feedback) };
}

function previousDay(ts: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() - 1);
  return d.getTime();
}

/** Consecutive days with at least one finished block, counting today only once it has one. */
export function currentStreak(days: Record<string, DayStat>, now: number): number {
  let t = (days[dayKey(now)]?.blocks ?? 0) > 0 ? now : previousDay(now);
  let count = 0;
  while ((days[dayKey(t)]?.blocks ?? 0) > 0) {
    count += 1;
    t = previousDay(t);
  }
  return count;
}

export function bestStreak(days: Record<string, DayStat>): number {
  const active = Object.keys(days)
    .filter((k) => days[k].blocks > 0)
    .sort();
  let best = 0;
  let run = 0;
  let prev: string | undefined;
  for (const key of active) {
    const [y, m, d] = key.split('-').map(Number);
    run = prev === dayKey(previousDay(new Date(y, m - 1, d, 12).getTime())) ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

export function dueCount(cards: Readonly<Record<string, CardState>>, until: number): number {
  let n = 0;
  for (const id in cards) if (cards[id].due <= until) n += 1;
  return n;
}

export interface Tally {
  total: number;
  learned: number;
  mastered: number;
}

export type LevelProgress = Record<Level, Tally & { byType: Record<ItemType, Tally> }>;

const emptyTally = (): Tally => ({ total: 0, learned: 0, mastered: 0 });

export function levelProgress(cards: Readonly<Record<string, CardState>>): LevelProgress {
  const out = Object.fromEntries(
    LEVELS.map((level) => [
      level,
      { ...emptyTally(), byType: Object.fromEntries(ITEM_TYPES.map((t) => [t, emptyTally()])) },
    ]),
  ) as LevelProgress;
  for (const item of ALL_ITEMS) {
    const card = cards[item.id];
    const row = out[item.level];
    const cell = row.byType[item.type];
    row.total += 1;
    cell.total += 1;
    if (card) {
      row.learned += 1;
      cell.learned += 1;
      if (isMastered(card)) {
        row.mastered += 1;
        cell.mastered += 1;
      }
    }
  }
  return out;
}

/**
 * FSRS difficulty (1–10) at or above this marks an item that was missed: a first "Again" starts
 * it around 6.4, a first "Good" around 2.
 */
const MISSED_DIFFICULTY = 6;

/**
 * Items the learner keeps forgetting, worst first: anything that lapsed after being learned,
 * plus items missed recently that are still being (re)learned.
 */
export function weakItems(cards: Readonly<Record<string, CardState>>, now: number, limit = 20): Item[] {
  return Object.entries(cards)
    .filter(([, card]) => card.lapses > 0 || (card.state !== State.Review && card.difficulty >= MISSED_DIFFICULTY))
    .sort(
      ([, a], [, b]) =>
        b.lapses - a.lapses || b.difficulty - a.difficulty || retrievability(a, now) - retrievability(b, now),
    )
    .flatMap(([id]) => {
      const item = getItem(id);
      return item ? [item] : [];
    })
    .slice(0, limit);
}

export function recentAccuracy(days: Record<string, DayStat>, now: number, span = 7): number | null {
  let answers = 0;
  let correct = 0;
  let t = now;
  for (let i = 0; i < span; i++) {
    const day = days[dayKey(t)];
    if (day) {
      answers += day.answers;
      correct += day.correct;
    }
    t = previousDay(t);
  }
  return answers > 0 ? correct / answers : null;
}

export function totalMs(days: Record<string, DayStat>): number {
  return Object.values(days).reduce((sum, d) => sum + d.ms, 0);
}

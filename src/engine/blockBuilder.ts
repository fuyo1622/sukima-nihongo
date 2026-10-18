import { getItem, ITEMS_BY_TYPE, KANA_ITEMS, skillOf } from '../content';
import { LEVELS, type Item, type ItemType, type Level } from '../content/types';
import { KANA_DONE, WINDOW_BELOW, type Ability } from './adaptive';
import { checkKind, makeStep, reviewKind, type Step } from './exercises';
import { pickWeighted, type Rng } from './random';
import { retrievability, State, type CardState } from './srs';

export type BlockMode =
  /** 智慧學習: due reviews plus new items picked by the adaptive engine. */
  | { type: 'smart' }
  /** 只複習: due items first, then the weakest learned items. */
  | { type: 'review' }
  /** New items and reviews from one level (chosen on the course screen). */
  | { type: 'level'; level: Level }
  /** One kind of content, e.g. the 漢字陷阱 (false friends) module. */
  | { type: 'itemType'; itemType: ItemType };

export interface Focus {
  vocab: boolean;
  kanji: boolean;
  grammar: boolean;
}

export interface BuildInput {
  mode: BlockMode;
  /** Target number of steps (an intro and its check count as two). */
  size: number;
  now: number;
  cards: Readonly<Record<string, CardState>>;
  ability: Ability;
  sound: boolean;
  difficultyMode: 'auto' | 'manual';
  manualLevel: Level;
  focus: Focus;
  rng: Rng;
}

/** Block length options, in steps. Roughly 10–20 seconds per step. */
export const BLOCK_SIZES = { 1: 5, 3: 10, 5: 16 } as const;

export function inKanaStage(ability: Ability, cards: Readonly<Record<string, CardState>>): boolean {
  return ability.theta.kana < KANA_DONE && KANA_ITEMS.some((k) => !cards[k.id]);
}

function matchesMode(item: Item, mode: BlockMode): boolean {
  if (mode.type === 'level') return item.level === mode.level;
  if (mode.type === 'itemType') return item.type === mode.itemType;
  return true;
}

/** Due items, most overdue first. */
export function dueItems(
  cards: Readonly<Record<string, CardState>>,
  now: number,
  filter: (item: Item) => boolean = () => true,
): Item[] {
  return Object.entries(cards)
    .filter(([, card]) => card.due <= now)
    .sort(([, a], [, b]) => a.due - b.due)
    .flatMap(([id]) => {
      const item = getItem(id);
      return item && filter(item) ? [item] : [];
    });
}

/** Learned items that are not due yet, least likely to be remembered first. */
function weakestLearned(
  cards: Readonly<Record<string, CardState>>,
  now: number,
  filter: (item: Item) => boolean,
  exclude: ReadonlySet<string>,
): Item[] {
  return Object.entries(cards)
    .filter(([id, card]) => card.state !== State.New && !exclude.has(id))
    .map(([id, card]) => ({ item: getItem(id), r: retrievability(card, now) }))
    .filter((x): x is { item: Item; r: number } => !!x.item && filter(x.item))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.item);
}

function newItemTarget(input: BuildInput, dueCount: number): number {
  const { size, mode, ability } = input;
  if (mode.type === 'review') return 0;
  const base = size >= 16 ? 4 : size >= 10 ? 3 : 1;
  let n = Math.round(base * ability.pace);
  // A big review backlog means the learner is overloaded: consolidate before adding more.
  if (mode.type === 'smart' && dueCount > size * 3) n = Math.min(n, 1);
  return Math.min(Math.max(n, mode.type === 'smart' ? 0 : 1), Math.floor(size / 2));
}

function typeWeights(input: BuildInput, kanaStage: boolean): Partial<Record<ItemType, number>> {
  const { mode, focus, cards } = input;
  if (mode.type === 'itemType') return { [mode.itemType]: 1 };
  if (mode.type === 'level' && mode.level === 'kana') return { kana: 1 };
  if (mode.type === 'smart') {
    const manualKana = input.difficultyMode === 'manual' && input.manualLevel === 'kana';
    if (manualKana || (input.difficultyMode === 'auto' && kanaStage)) {
      const hiraganaBasicsSeen = KANA_ITEMS.every(
        (k) => k.script !== 'hiragana' || k.group !== 'basic' || cards[k.id],
      );
      if (KANA_ITEMS.some((k) => !cards[k.id])) {
        // Once the basic hiragana are in, mix in easy words so the kana get used right away.
        return hiraganaBasicsSeen ? { kana: 0.6, vocab: 0.4 } : { kana: 1 };
      }
    }
  }
  const weights: Partial<Record<ItemType, number>> = {};
  if (focus.vocab) weights.vocab = 0.5;
  if (focus.kanji) weights.kanji = 0.25;
  if (focus.grammar) weights.grammar = 0.25;
  if (focus.vocab) weights.trap = 0.06;
  if (Object.keys(weights).length === 0) weights.vocab = 1;
  return weights;
}

/** Unseen items of a type, easiest first, filtered by the block mode and the learner's level. */
function candidates(type: ItemType, input: BuildInput): Item[] {
  const { cards, mode, ability } = input;
  const unseen = ITEMS_BY_TYPE[type].filter((item) => !cards[item.id]);
  if (mode.type === 'level') return unseen.filter((item) => item.level === mode.level);
  if (mode.type === 'itemType') return unseen;
  if (input.difficultyMode === 'manual') {
    // Stay on the chosen level; move up only when it is exhausted.
    for (const level of LEVELS.slice(LEVELS.indexOf(input.manualLevel))) {
      const atLevel = unseen.filter((item) => item.level === level);
      if (atLevel.length > 0) return atLevel;
    }
    return [];
  }
  if (type === 'kana') return unseen;
  const floor = ability.theta[skillOf(type)] - WINDOW_BELOW;
  return unseen.filter((item) => item.d >= floor);
}

export function pickNewItems(input: BuildInput, count: number): Item[] {
  const weights = typeWeights(input, inKanaStage(input.ability, input.cards));
  const pools = new Map<ItemType, Item[]>();
  const picked: Item[] = [];
  while (picked.length < count) {
    const type = pickWeighted(weights, input.rng);
    if (!type) break;
    let pool = pools.get(type);
    if (!pool) {
      pool = candidates(type, input);
      pools.set(type, pool);
    }
    const next = pool.shift();
    if (next) picked.push(next);
    else delete weights[type];
  }
  return picked;
}

/**
 * Interleaves intros, their checks and reviews: each new item is checked one or two steps
 * after it is introduced, with reviews in between as spacing.
 */
function arrange(newItems: Item[], reviewItems: Item[], input: BuildInput): Step[] {
  const { rng, sound, cards } = input;
  const steps: Step[] = [];
  const intros = newItems.slice();
  const reviews = reviewItems.slice();
  const pendingChecks: { item: Item; readyAt: number }[] = [];
  const nextId = () => `s${steps.length}`;
  const pushCheck = (item: Item) => steps.push(makeStep(item, checkKind(item, sound, rng), 'check', nextId(), rng));

  while (intros.length > 0 || reviews.length > 0 || pendingChecks.length > 0) {
    if (pendingChecks.length > 0 && pendingChecks[0].readyAt <= steps.length) {
      pushCheck(pendingChecks.shift()!.item);
    } else if (intros.length > 0 && (reviews.length === 0 || steps.length % 2 === 0)) {
      const item = intros.shift()!;
      steps.push(makeStep(item, 'intro', 'intro', nextId(), rng));
      pendingChecks.push({ item, readyAt: steps.length + 1 });
    } else if (reviews.length > 0) {
      const item = reviews.shift()!;
      const reps = cards[item.id]?.reps ?? 0;
      steps.push(makeStep(item, reviewKind(item, reps, sound), 'review', nextId(), rng, reps));
    } else {
      pushCheck(pendingChecks.shift()!.item);
    }
  }
  return steps;
}

/** Builds one learning block (學習小節). Returns [] when there is nothing to study for the mode. */
export function buildBlock(input: BuildInput): Step[] {
  const { size, now, cards, mode } = input;
  const filter = (item: Item) => matchesMode(item, mode);
  const due = dueItems(cards, now, filter);

  let newCount = newItemTarget(input, due.length);
  const reviews = due.slice(0, size - newCount * 2);
  const freeSlots = size - newCount * 2 - reviews.length;
  // Few reviews due: spend the free slots on new material instead.
  if (mode.type !== 'review' && freeSlots > 1) newCount += Math.floor(freeSlots / 2);

  const newItems = pickNewItems(input, newCount);
  const used = newItems.length * 2 + reviews.length;
  if (used < size) {
    // Nothing new left (or review-only mode): practise the weakest learned items early.
    const exclude = new Set(reviews.map((item) => item.id));
    reviews.push(...weakestLearned(cards, now, filter, exclude).slice(0, size - used));
  }
  return arrange(newItems, reviews, input);
}

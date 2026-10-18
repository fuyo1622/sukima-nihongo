import { ITEMS_BY_TYPE } from '../content';
import { hasKanji } from '../content/text';
import type { Item, ItemType, Level } from '../content/types';
import { KANA_DONE } from './adaptive';
import { makeStep, type ExerciseKind, type Step } from './exercises';
import { levelForTheta } from './levels';
import { pickOne, type Rng } from './random';

/**
 * Placement test (程度測驗): a short staircase. Each answer moves the estimate up or down,
 * with steps that shrink as the test goes on. Questions never need sound.
 */
export const PLACEMENT_LENGTH = 14;
const START_THETA = 300;

export interface PlacementState {
  theta: number;
  asked: string[];
  answered: number;
  correct: number;
}

export function startPlacement(): PlacementState {
  return { theta: START_THETA, asked: [], answered: 0, correct: 0 };
}

const ROTATION: ItemType[] = ['vocab', 'kanji', 'grammar'];

function kindFor(item: Item): ExerciseKind {
  switch (item.type) {
    case 'kana':
      return 'kana_read';
    case 'vocab':
      return hasKanji(item.word) ? 'vocab_reading' : 'vocab_meaning';
    case 'kanji':
      return 'kanji_reading';
    case 'grammar':
      return 'grammar_cloze';
    case 'trap':
      return 'trap_meaning';
  }
}

export function placementQuestion(state: PlacementState, rng: Rng): Step | null {
  const type = state.theta < KANA_DONE ? 'kana' : ROTATION[state.answered % ROTATION.length];
  const asked = new Set(state.asked);
  const nearest = ITEMS_BY_TYPE[type]
    .filter((item) => !asked.has(item.id))
    .sort((a, b) => Math.abs(a.d - state.theta) - Math.abs(b.d - state.theta))
    .slice(0, 8);
  if (nearest.length === 0) return null;
  const item = pickOne(nearest, rng);
  return makeStep(item, kindFor(item), 'check', `p${state.answered}`, rng);
}

export function answerPlacement(state: PlacementState, itemId: string, correct: boolean): PlacementState {
  const step = Math.max(35, 150 * 0.82 ** state.answered);
  const theta = Math.min(1000, Math.max(0, state.theta + (correct ? step : -step)));
  return {
    theta,
    asked: [...state.asked, itemId],
    answered: state.answered + 1,
    correct: state.correct + (correct ? 1 : 0),
  };
}

export function placementFinished(state: PlacementState): boolean {
  return state.answered >= PLACEMENT_LENGTH;
}

export function placementLevel(state: PlacementState): Level {
  return state.theta < KANA_DONE ? 'kana' : levelForTheta(state.theta);
}

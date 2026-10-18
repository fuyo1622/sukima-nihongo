import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from 'ts-fsrs';

export { Rating, State, type Grade };

/**
 * FSRS card state stored as plain JSON (timestamps instead of Dates), so it can be
 * persisted as-is and passed straight back to ts-fsrs, which accepts numeric dates.
 */
export interface CardState {
  due: number;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  learning_steps: number;
  reps: number;
  lapses: number;
  state: State;
  last_review?: number;
}

const scheduler = fsrs({
  request_retention: 0.9,
  maximum_interval: 3650,
  enable_fuzz: true,
});

function fromCard(card: Card): CardState {
  return {
    due: card.due.getTime(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    last_review: card.last_review?.getTime(),
  };
}

export function newCard(now: number): CardState {
  return fromCard(createEmptyCard(new Date(now)));
}

export function reviewCard(card: CardState | undefined, grade: Grade, now: number): CardState {
  return fromCard(scheduler.next(card ?? newCard(now), now, grade).card);
}

/** Probability of recalling the item right now (0–1). */
export function retrievability(card: CardState, now: number): number {
  if (card.state === State.New) return 0;
  return scheduler.get_retrievability(card, now, false);
}

export function isDue(card: CardState, now: number): boolean {
  return card.due <= now;
}

/** Remembered for three weeks or more: shown as "mastered" (熟練). */
export function isMastered(card: CardState): boolean {
  return card.state === State.Review && card.stability >= 21;
}

/**
 * Beyond this, a long answer time says more about the learner being interrupted (a station
 * announcement, a bite of food) than about a shaky memory, so it is not counted as slow.
 */
export const INTERRUPTED_MS = 45_000;

export function isSlow(ms: number, slowMs: number): boolean {
  return ms > slowMs && ms <= INTERRUPTED_MS;
}

/**
 * Multiple-choice answers carry less information than a self-graded flashcard, so the
 * grade comes from correctness plus speed: wrong → Again, slow → Hard, otherwise Good.
 * Passing an intro card's "I already know this" and then answering correctly → Easy.
 */
export function gradeFor(correct: boolean, ms: number, slowMs: number, testedOut: boolean): Grade {
  if (!correct) return Rating.Again;
  if (testedOut) return Rating.Easy;
  if (isSlow(ms, slowMs)) return Rating.Hard;
  return Rating.Good;
}

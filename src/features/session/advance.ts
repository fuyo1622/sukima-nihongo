/** 答對自動下一題: how long a correct answer stays on screen before the next question. */
export const SHOW_MS = 2000;
/** Pause after the spoken answer ends, so the next question doesn't start mid-sentence. */
export const AFTER_SPEECH_MS = 700;

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Resolves when a correctly answered question may move on: once the answer card has been on screen
 * for SHOW_MS, and once the spoken answer (if any) has finished plus AFTER_SPEECH_MS.
 */
export function readyToAdvance(speech?: Promise<void>): Promise<void> {
  return Promise.all([wait(SHOW_MS), speech?.then(() => wait(AFTER_SPEECH_MS))]).then(() => undefined);
}

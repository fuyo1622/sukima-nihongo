import { AFTER_SPEECH_MS, readyToAdvance, SHOW_MS } from '../advance';

/** After a correct answer: when the next question may come. */
describe('moving on after a correct answer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const track = (p: Promise<void>) => {
    const state = { done: false };
    void p.then(() => (state.done = true));
    return state;
  };
  const speechEndingAfter = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

  it('keeps the answer card on screen for SHOW_MS when nothing is spoken', async () => {
    const ready = track(readyToAdvance());
    await jest.advanceTimersByTimeAsync(SHOW_MS - 1);
    expect(ready.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(ready.done).toBe(true);
  });

  it('waits for a long spoken answer to finish, plus a pause', async () => {
    const ready = track(readyToAdvance(speechEndingAfter(3500)));
    await jest.advanceTimersByTimeAsync(3500 + AFTER_SPEECH_MS - 1);
    expect(ready.done).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(ready.done).toBe(true);
  });

  it('still shows the card for SHOW_MS after a short word', async () => {
    const ready = track(readyToAdvance(speechEndingAfter(300)));
    await jest.advanceTimersByTimeAsync(300 + AFTER_SPEECH_MS);
    expect(ready.done).toBe(false);
    await jest.advanceTimersByTimeAsync(SHOW_MS - 300 - AFTER_SPEECH_MS);
    expect(ready.done).toBe(true);
  });
});

import { answerPlacement, placementFinished, placementLevel, placementQuestion, startPlacement } from '../placement';
import { mulberry32 } from '../random';

function run(answer: (i: number) => boolean) {
  const rng = mulberry32(11);
  let state = startPlacement();
  const asked: string[] = [];
  while (!placementFinished(state)) {
    const step = placementQuestion(state, rng);
    if (!step) break;
    asked.push(step.itemId);
    state = answerPlacement(state, step.itemId, answer(state.answered));
  }
  return { state, asked };
}

describe('placement test', () => {
  it('places someone who knows nothing at the kana stage', () => {
    expect(placementLevel(run(() => false).state)).toBe('kana');
  });

  it('places someone who answers everything far above beginner level', () => {
    const { state } = run(() => true);
    expect(['N2', 'N1']).toContain(placementLevel(state));
  });

  it('settles between the extremes for mixed answers', () => {
    const level = placementLevel(run((i) => i % 2 === 0).state);
    expect(['N5', 'N4', 'N3']).toContain(level);
  });

  it('never asks the same item twice', () => {
    const { asked } = run((i) => i % 3 !== 0);
    expect(new Set(asked).size).toBe(asked.length);
  });
});

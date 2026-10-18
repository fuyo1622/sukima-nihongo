import { getItem, ITEMS_BY_TYPE } from '../../content';
import { abilityForLevel, DEFAULT_ABILITY } from '../adaptive';
import { buildBlock, type BuildInput } from '../blockBuilder';
import { LISTENING_KINDS } from '../exercises';
import { mulberry32 } from '../random';
import { newCard, Rating, reviewCard, type CardState } from '../srs';

const NOW = new Date(2026, 8, 24, 8, 0).getTime();
const DAY = 86_400_000;

function input(overrides: Partial<BuildInput> = {}): BuildInput {
  return {
    mode: { type: 'smart' },
    size: 10,
    now: NOW,
    cards: {},
    ability: DEFAULT_ABILITY,
    sound: true,
    difficultyMode: 'auto',
    manualLevel: 'N5',
    focus: { vocab: true, kanji: true, grammar: true },
    rng: mulberry32(1),
    ...overrides,
  };
}

/** Cards for the given items, reviewed a week ago so they are due now. */
function dueCards(ids: string[]): Record<string, CardState> {
  const cards: Record<string, CardState> = {};
  for (const id of ids) cards[id] = { ...reviewCard(newCard(NOW - 7 * DAY), Rating.Good, NOW - 7 * DAY), due: NOW - DAY };
  return cards;
}

describe('buildBlock', () => {
  it('starts a complete beginner with hiragana, easiest first', () => {
    const steps = buildBlock(input());
    expect(steps).toHaveLength(10);
    const items = steps.map((s) => getItem(s.itemId)!);
    expect(items.every((i) => i.type === 'kana')).toBe(true);
    expect(steps[0]).toMatchObject({ role: 'intro', itemId: 'ka:あ' });
  });

  it('checks every new item after introducing it', () => {
    const steps = buildBlock(input({ ability: abilityForLevel('N5') }));
    steps.forEach((step, i) => {
      if (step.role !== 'check') return;
      const introIndex = steps.findIndex((s) => s.role === 'intro' && s.itemId === step.itemId);
      expect(introIndex).toBeGreaterThanOrEqual(0);
      expect(introIndex).toBeLessThan(i);
    });
  });

  it('gives an N5 learner N5 vocabulary, kanji or grammar instead of kana', () => {
    const steps = buildBlock(input({ ability: abilityForLevel('N5'), size: 16 }));
    const items = steps.map((s) => getItem(s.itemId)!);
    expect(items.some((i) => i.type === 'kana')).toBe(false);
    expect(items.every((i) => i.level === 'N5')).toBe(true);
  });

  it('skips material below the learner’s level', () => {
    const steps = buildBlock(input({ ability: abilityForLevel('N4') }));
    const firstNew = getItem(steps.find((s) => s.role === 'intro')!.itemId)!;
    expect(firstNew.d).toBeGreaterThanOrEqual(abilityForLevel('N4').theta.vocab - 120);
  });

  it('never uses listening exercises in silent mode', () => {
    for (let seed = 0; seed < 10; seed++) {
      const due = dueCards(ITEMS_BY_TYPE.vocab.slice(0, 12).map((i) => i.id));
      const steps = buildBlock(input({ sound: false, cards: due, rng: mulberry32(seed), ability: abilityForLevel('N5') }));
      expect(steps.some((s) => LISTENING_KINDS.has(s.kind))).toBe(false);
    }
  });

  it('puts due reviews into the block, oldest first', () => {
    const ids = ITEMS_BY_TYPE.vocab.slice(0, 20).map((i) => i.id);
    const cards = dueCards(ids);
    cards[ids[5]] = { ...cards[ids[5]], due: NOW - 5 * DAY };
    const steps = buildBlock(input({ mode: { type: 'review' }, cards }));
    expect(steps).toHaveLength(10);
    expect(steps.every((s) => s.role === 'review')).toBe(true);
    expect(steps[0].itemId).toBe(ids[5]);
  });

  it('returns nothing to review for a brand-new learner', () => {
    expect(buildBlock(input({ mode: { type: 'review' } }))).toEqual([]);
  });

  it('keeps manual mode on the chosen level', () => {
    const steps = buildBlock(input({ difficultyMode: 'manual', manualLevel: 'N5', ability: abilityForLevel('N1') }));
    for (const step of steps) expect(getItem(step.itemId)!.level).toBe('N5');
  });

  it('builds a false-friend block from the trap module', () => {
    const steps = buildBlock(input({ mode: { type: 'itemType', itemType: 'trap' }, size: 5 }));
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) expect(getItem(step.itemId)!.type).toBe('trap');
  });

  it('is deterministic for a given seed', () => {
    const a = buildBlock(input({ ability: abilityForLevel('N5'), rng: mulberry32(9) }));
    const b = buildBlock(input({ ability: abilityForLevel('N5'), rng: mulberry32(9) }));
    expect(a).toEqual(b);
  });

  it('favours reviews when there is a large backlog', () => {
    const ids = ITEMS_BY_TYPE.vocab.slice(0, 60).map((i) => i.id);
    const steps = buildBlock(input({ ability: abilityForLevel('N5'), cards: dueCards(ids) }));
    expect(steps.filter((s) => s.role === 'intro').length).toBeLessThanOrEqual(1);
  });
});

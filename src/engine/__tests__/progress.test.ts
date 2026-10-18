import { ALL_ITEMS, getItem } from '../../content';
import { abilityForLevel, applyFeedback, DEFAULT_ABILITY, overallLevel, updateAbility } from '../adaptive';
import { makeStep } from '../exercises';
import {
  applyAnswer,
  bestStreak,
  completeBlock,
  currentStreak,
  dayKey,
  emptyProgress,
  levelProgress,
  weakItems,
  type DayStat,
} from '../progress';
import { mulberry32 } from '../random';
import { gradeFor, Rating, State } from '../srs';

const NOW = new Date(2026, 8, 24, 8, 0).getTime();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const item = getItem('v:学生:がくせい')!;
const check = makeStep(item, 'vocab_reading', 'check', 's1', mulberry32(1));

describe('applyAnswer', () => {
  it('schedules a correctly answered new item and raises ability', () => {
    const p = applyAnswer(emptyProgress(abilityForLevel('N5')), check, { choice: 0, correct: true, ms: 2000, at: NOW }, false, NOW);
    const card = p.cards[item.id];
    expect(card.state).not.toBe(State.New);
    expect(card.due).toBeGreaterThan(NOW);
    expect(p.ability.theta.vocab).toBeGreaterThan(abilityForLevel('N5').theta.vocab);
    expect(p.days[dayKey(NOW)]).toMatchObject({ answers: 1, correct: 1, newItems: 1 });
  });

  it('brings a missed item back soon and lowers ability', () => {
    const start = emptyProgress(abilityForLevel('N5'));
    const p = applyAnswer(start, check, { choice: 1, correct: false, ms: 2000, at: NOW }, false, NOW);
    expect(p.cards[item.id].due).toBeLessThan(NOW + HOUR);
    expect(p.ability.theta.vocab).toBeLessThan(start.ability.theta.vocab);
  });

  it('schedules tested-out items further out than normal ones', () => {
    const start = emptyProgress(abilityForLevel('N5'));
    const answer = { choice: 0, correct: true, ms: 2000, at: NOW };
    const normal = applyAnswer(start, check, answer, false, NOW);
    const known = applyAnswer(start, check, answer, true, NOW);
    expect(known.cards[item.id].due).toBeGreaterThan(normal.cards[item.id].due);
  });

  it('treats retries as practice only', () => {
    const start = emptyProgress();
    const p = applyAnswer(start, { ...check, role: 'retry' }, { choice: 0, correct: true, ms: 2000, at: NOW }, false, NOW);
    expect(p.cards[item.id]).toBeUndefined();
    expect(p.ability).toBe(start.ability);
    expect(p.days[dayKey(NOW)].answers).toBe(1);
  });

  it('does not treat a very long answer as slow: the learner was probably interrupted', () => {
    const start = emptyProgress(abilityForLevel('N5'));
    const quick = applyAnswer(start, check, { choice: 0, correct: true, ms: 2000, at: NOW }, false, NOW);
    const slow = applyAnswer(start, check, { choice: 0, correct: true, ms: 20_000, at: NOW }, false, NOW);
    const interrupted = applyAnswer(start, check, { choice: 0, correct: true, ms: 5 * 60_000, at: NOW }, false, NOW);
    expect(slow.cards[item.id].difficulty).toBeGreaterThan(quick.cards[item.id].difficulty);
    expect(interrupted.cards[item.id].difficulty).toBeCloseTo(quick.cards[item.id].difficulty);
  });

  it('lists recently missed items as weak, but not ones answered well', () => {
    const other = getItem('v:先生:せんせい')!;
    const otherCheck = makeStep(other, 'vocab_reading', 'check', 's2', mulberry32(2));
    let p = emptyProgress(abilityForLevel('N5'));
    p = applyAnswer(p, check, { choice: null, correct: false, ms: 2000, at: NOW }, false, NOW);
    p = applyAnswer(p, otherCheck, { choice: otherCheck.answer!, correct: true, ms: 2000, at: NOW }, false, NOW);
    expect(weakItems(p.cards, NOW).map((i) => i.id)).toEqual([item.id]);
  });

  it('ignores intro cards', () => {
    const start = emptyProgress();
    const intro = makeStep(item, 'intro', 'intro', 's0', mulberry32(1));
    expect(applyAnswer(start, intro, { choice: null, correct: true, ms: 0, at: NOW }, false, NOW)).toBe(start);
  });
});

describe('gradeFor', () => {
  it('maps multiple-choice answers to FSRS grades', () => {
    expect(gradeFor(false, 1000, 8000, false)).toBe(Rating.Again);
    expect(gradeFor(true, 1000, 8000, true)).toBe(Rating.Easy);
    expect(gradeFor(true, 12_000, 8000, false)).toBe(Rating.Hard);
    expect(gradeFor(true, 1000, 8000, false)).toBe(Rating.Good);
    expect(gradeFor(true, 120_000, 8000, false)).toBe(Rating.Good);
  });
});

describe('adaptive ability', () => {
  it('moves up with correct answers and down with mistakes', () => {
    const a = abilityForLevel('N4');
    expect(updateAbility(a, 'grammar', 400, 1).theta.grammar).toBeGreaterThan(a.theta.grammar);
    expect(updateAbility(a, 'grammar', 400, 0).theta.grammar).toBeLessThan(a.theta.grammar);
    expect(updateAbility(a, 'grammar', 400, 1).n.grammar).toBe(1);
  });

  it('responds to "too easy" and "too hard" feedback', () => {
    const a = abilityForLevel('N4');
    const easy = applyFeedback(a, ['vocab'], 'easy');
    const hard = applyFeedback(a, ['vocab'], 'hard');
    expect(easy.theta.vocab).toBe(a.theta.vocab + 40);
    expect(easy.pace).toBeGreaterThan(a.pace);
    expect(hard.theta.vocab).toBe(a.theta.vocab - 40);
    expect(hard.pace).toBeLessThan(a.pace);
    expect(easy.theta.kanji).toBe(a.theta.kanji);
  });

  it('reports the overall level', () => {
    expect(overallLevel(DEFAULT_ABILITY, true)).toBe('kana');
    expect(overallLevel(abilityForLevel('N3'), false)).toBe('N3');
    expect(overallLevel(abilityForLevel('N1'), false)).toBe('N1');
  });
});

describe('streaks and stats', () => {
  const day = (blocks: number): DayStat => ({ blocks, answers: 0, correct: 0, newItems: 0, ms: 0 });

  it('counts consecutive days, including yesterday when today is not done yet', () => {
    const days = {
      [dayKey(NOW - 2 * DAY)]: day(1),
      [dayKey(NOW - DAY)]: day(2),
    };
    expect(currentStreak(days, NOW)).toBe(2);
    expect(currentStreak({ ...days, [dayKey(NOW)]: day(1) }, NOW)).toBe(3);
    expect(currentStreak({ [dayKey(NOW - 3 * DAY)]: day(1) }, NOW)).toBe(0);
  });

  it('finds the best streak', () => {
    const days = {
      '2026-09-01': day(1),
      '2026-09-02': day(1),
      '2026-09-03': day(1),
      '2026-09-10': day(1),
      '2026-09-11': day(0),
    };
    expect(bestStreak(days)).toBe(3);
  });

  it('counts finished blocks per day', () => {
    const p = completeBlock(completeBlock(emptyProgress(), NOW), NOW);
    expect(p.days[dayKey(NOW)].blocks).toBe(2);
  });

  it('tallies progress per level', () => {
    const p = applyAnswer(emptyProgress(abilityForLevel('N5')), check, { choice: 0, correct: true, ms: 1, at: NOW }, false, NOW);
    const progress = levelProgress(p.cards);
    expect(progress.N5.learned).toBe(1);
    expect(progress.N5.byType.vocab.learned).toBe(1);
    const total = Object.values(progress).reduce((sum, row) => sum + row.total, 0);
    expect(total).toBe(ALL_ITEMS.length);
  });
});

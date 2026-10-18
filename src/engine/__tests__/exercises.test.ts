import { getItem, ITEMS_BY_TYPE, KANJI_ITEMS } from '../../content';
import type { Item, VocabItem } from '../../content/types';
import {
  buildQuestion,
  checkKind,
  glossNamesItself,
  meaningsClash,
  playableKind,
  readingMutations,
  reshuffled,
  reviewKind,
  type ExerciseKind,
} from '../exercises';
import { mulberry32 } from '../random';

const KINDS: Record<Item['type'], ExerciseKind[]> = {
  kana: ['kana_read', 'kana_pick', 'kana_listen'],
  vocab: ['vocab_meaning', 'vocab_reading', 'vocab_word', 'vocab_listen'],
  kanji: ['kanji_meaning', 'kanji_reading', 'kanji_form'],
  grammar: ['grammar_cloze'],
  trap: ['trap_meaning'],
};

function correctValue(item: Item, kind: ExerciseKind): string[] {
  switch (item.type) {
    case 'kana':
      return kind === 'kana_read' ? [item.romaji] : [item.kana];
    case 'vocab':
      if (kind === 'vocab_reading') return [item.reading];
      if (kind === 'vocab_word') return [item.word];
      return [item.meaning];
    case 'kanji':
      if (kind === 'kanji_form' && item.trad) return [item.trad];
      if (kind === 'kanji_reading') return [...item.on, ...item.kun.map((k) => k.replace(/[.\-]/g, ''))];
      return [item.meaning];
    case 'grammar':
      return item.quizzes.map((q) => q.answer);
    case 'trap':
      return [item.meaning];
  }
}

describe('buildQuestion', () => {
  const rng = mulberry32(42);

  it.each(Object.keys(KINDS) as Item['type'][])('builds valid multiple choice for %s items', (type) => {
    const items = ITEMS_BY_TYPE[type];
    // Every 7th item keeps the test fast while covering all levels.
    for (let i = 0; i < items.length; i += 7) {
      const item = items[i];
      for (const kind of KINDS[type]) {
        const q = buildQuestion(item, kind, rng);
        expect(q.options.length).toBe(4);
        expect(new Set(q.options).size).toBe(q.options.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(correctValue(item, kind)).toContain(q.options[q.answer]);
      }
    }
  });

  it('never offers a distractor that shares a sense with the answer', () => {
    for (const item of ITEMS_BY_TYPE.vocab.slice(0, 200)) {
      const q = buildQuestion(item, 'vocab_meaning', rng);
      q.options.forEach((option, i) => {
        if (i !== q.answer) expect(meaningsClash(option, q.options[q.answer])).toBe(false);
      });
    }
  });

  it('rotates grammar quiz sentences with the review count', () => {
    const item = ITEMS_BY_TYPE.grammar[0];
    if (item.type !== 'grammar' || item.quizzes.length < 2) return;
    expect(buildQuestion(item, 'grammar_cloze', rng, 0).variant).toBe(0);
    expect(buildQuestion(item, 'grammar_cloze', rng, 1).variant).toBe(1);
  });
});

describe('readingMutations', () => {
  it('produces near misses around long vowels, っ and voicing', () => {
    const m = readingMutations('がっこう');
    expect(m).toEqual(expect.arrayContaining(['がこう', 'かっこう', 'がっこ']));
    expect(m).not.toContain('がっこう');
  });

  it('adds and removes long vowels', () => {
    expect(readingMutations('おばさん')).toEqual(expect.arrayContaining(['おうばさん']));
    expect(readingMutations('せんせい')).toContain('せんせ');
    expect(readingMutations('コーヒー')).toEqual(expect.arrayContaining(['コヒー', 'コーヒ']));
  });

  it('toggles small ゃゅょ', () => {
    expect(readingMutations('きょう')).toContain('きよう');
  });
});

describe('exercise selection', () => {
  const rng = mulberry32(7);
  const kanjiWord = getItem('v:学生:がくせい')!;
  const kanaWord = getItem('v:ありがとうございます:ありがとうございます')!;

  it('checks the reading of kanji words and the meaning of kana words when silent', () => {
    expect(checkKind(kanjiWord, false, rng)).toBe('vocab_reading');
    expect(checkKind(kanaWord, false, rng)).toBe('vocab_meaning');
  });

  it('never picks listening exercises without sound', () => {
    for (let reps = 0; reps < 8; reps++) {
      expect(['kana_listen', 'vocab_listen']).not.toContain(reviewKind(kanjiWord, reps, false));
    }
  });

  it('never asks the meaning of a word or kanji whose Chinese gloss is the word itself', () => {
    const school = getItem('v:学校:がっこう') as VocabItem; // 「學校」
    const study = getItem('v:勉強:べんきょう') as VocabItem; // 「讀書；學習」
    const fire = KANJI_ITEMS.find((k) => k.kanji === '火')!; // 「火」
    const gaku = KANJI_ITEMS.find((k) => k.kanji === '学')!; // 學, 「學習」
    expect(glossNamesItself(school.word, school.meaning)).toBe(true);
    expect(glossNamesItself(study.word, study.meaning)).toBe(false);
    const kinds = (item: Item, sound: boolean) => new Set(Array.from({ length: 6 }, (_, r) => reviewKind(item, r, sound)));
    expect([...kinds(school, false)]).toEqual(['vocab_reading']);
    expect([...kinds(school, true)].sort()).toEqual(['vocab_listen', 'vocab_reading']);
    expect(kinds(study, false)).toEqual(new Set(['vocab_reading', 'vocab_word', 'vocab_meaning']));
    expect(kinds(fire, false)).toEqual(new Set(['kanji_reading']));
    expect(kinds(gaku, false)).toEqual(new Set(['kanji_reading', 'kanji_form', 'kanji_meaning']));
  });

  it('maps listening exercises to silent twins with the same options', () => {
    expect(playableKind('vocab_listen', false)).toBe('vocab_meaning');
    expect(playableKind('kana_listen', false)).toBe('kana_pick');
    expect(playableKind('vocab_listen', true)).toBe('vocab_listen');
    expect(playableKind('grammar_cloze', false)).toBe('grammar_cloze');
  });

  it('reshuffles a retry without changing the correct answer', () => {
    const q = buildQuestion(kanjiWord, 'vocab_meaning', rng);
    const step = { id: 's1', itemId: kanjiWord.id, kind: 'vocab_meaning' as const, role: 'review' as const, ...q };
    const retry = reshuffled(step, 's1r', rng);
    expect(retry.role).toBe('retry');
    expect(retry.options![retry.answer!]).toBe(q.options[q.answer]);
    expect([...retry.options!].sort()).toEqual([...q.options].sort());
  });
});

import { ALL_ITEMS, getItem, ITEM_COUNTS, ITEMS_BY_TYPE, KANA_ITEMS } from '..';
import { LEVEL_BANDS } from '../../engine/levels';
import { parseRuby, rubyBase, rubyReading, toHiragana } from '../text';
import { BLANK, LEVELS } from '../types';

describe('content bundle', () => {
  it('has unique ids that resolve back to their item', () => {
    const ids = ALL_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of ALL_ITEMS) expect(getItem(item.id)).toBe(item);
  });

  it('keeps every difficulty inside its level band', () => {
    for (const item of ALL_ITEMS) {
      const [lo, hi] = LEVEL_BANDS[item.level];
      expect(item.d).toBeGreaterThanOrEqual(lo);
      expect(item.d).toBeLessThanOrEqual(hi);
    }
  });

  it('covers every level from kana to N1', () => {
    for (const level of LEVELS) {
      const total = Object.values(ITEM_COUNTS[level]).reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(0);
    }
  });

  it('has the full kana set: basic, dakuten, handakuten and yōon in both scripts', () => {
    expect(KANA_ITEMS).toHaveLength(208);
    expect(KANA_ITEMS.filter((k) => k.script === 'katakana')).toHaveLength(104);
    expect(KANA_ITEMS[0].kana).toBe('あ');
    expect(KANA_ITEMS.find((k) => k.kana === 'ア')?.origin).toBe('阿');
  });

  it('sorts items of each type from easiest to hardest', () => {
    for (const items of Object.values(ITEMS_BY_TYPE)) {
      for (let i = 1; i < items.length; i++) expect(items[i].d).toBeGreaterThanOrEqual(items[i - 1].d);
    }
  });

  it('has well-formed grammar quizzes', () => {
    for (const item of ITEMS_BY_TYPE.grammar) {
      if (item.type !== 'grammar') continue;
      expect(item.examples.length).toBeGreaterThan(0);
      for (const quiz of item.quizzes) {
        expect(quiz.ja.split(BLANK)).toHaveLength(2);
        const options = [quiz.answer, ...quiz.distractors];
        expect(new Set(options).size).toBe(4);
      }
    }
  });

  it('uses valid ruby notation everywhere', () => {
    const texts = ALL_ITEMS.flatMap((item) => {
      switch (item.type) {
        case 'vocab':
        case 'trap':
          return [item.ruby, item.example?.ja ?? ''];
        case 'grammar':
          return [...item.examples.map((e) => e.ja), ...item.quizzes.map((q) => q.ja)];
        default:
          return [];
      }
    });
    for (const text of texts) {
      for (const seg of parseRuby(text)) {
        if (!seg.ruby) expect(seg.text).not.toMatch(/[{}|]/);
      }
    }
  });

  it('gives every word an example sentence that uses it', () => {
    for (const item of ITEMS_BY_TYPE.vocab) {
      if (item.type !== 'vocab') continue;
      expect(item.example).toBeDefined();
      const { word, reading, pos } = item;
      // Conjugated forms keep the stem (食べ, 拝見); kanji words may be written in kana (かすんで for 霞む).
      const cut = (s: string) => (s.endsWith('する') ? s.slice(0, -2) : ['v1', 'v5', 'vk', 'vz', 'adj-i'].includes(pos) ? s.slice(0, -1) : s);
      const used =
        rubyBase(item.example!.ja).includes(cut(word)) || toHiragana(rubyReading(item.example!.ja)).includes(toHiragana(cut(reading)));
      if (!used) throw new Error(`${item.id}: example does not use the word: ${item.example!.ja}`);
    }
  });

  it('credits every Tatoeba sentence with a valid id', () => {
    const sources = ITEMS_BY_TYPE.vocab.flatMap((item) => (item.type === 'vocab' && item.example?.source ? [item.example.source] : []));
    expect(sources.length).toBeGreaterThan(2000);
    for (const s of sources) {
      expect(Number.isInteger(s.id) && s.id > 0).toBe(true);
      if (s.zhId !== undefined) expect(Number.isInteger(s.zhId) && s.zhId > 0).toBe(true);
    }
    expect(new Set(sources.map((s) => s.id)).size).toBe(sources.length);
  });

  it('marks traditional forms only when they differ from the Japanese form', () => {
    for (const item of ITEMS_BY_TYPE.kanji) {
      if (item.type === 'kanji' && item.trad) expect(item.trad).not.toBe(item.kanji);
    }
    expect(getItem('k:学')).toMatchObject({ trad: '學' });
  });
});

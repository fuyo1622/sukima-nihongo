import { alignRuby, isKanaOnly, kunPlain, parseRuby, rubyBase, rubyReading, toHiragana, toKatakana } from '../text';

describe('ruby notation', () => {
  it('parses annotated and plain segments', () => {
    expect(parseRuby('{私|わたし}は{学生|がくせい}です')).toEqual([
      { text: '私', ruby: 'わたし' },
      { text: 'は' },
      { text: '学生', ruby: 'がくせい' },
      { text: 'です' },
    ]);
  });

  it('extracts the base text and the reading', () => {
    const src = '{毎朝|まいあさ}パンを{食|た}べます。';
    expect(rubyBase(src)).toBe('毎朝パンを食べます。');
    expect(rubyReading(src)).toBe('まいあさパンをたべます。');
  });

  it('handles text without annotations', () => {
    expect(parseRuby('こんにちは')).toEqual([{ text: 'こんにちは' }]);
  });
});

describe('alignRuby', () => {
  it.each([
    ['食べる', 'たべる', '{食|た}べる'],
    ['取り消す', 'とりけす', '{取|と}り{消|け}す'],
    ['お茶', 'おちゃ', 'お{茶|ちゃ}'],
    ['消しゴム', 'けしゴム', '{消|け}しゴム'],
    ['明日', 'あした', '{明日|あした}'],
    ['話し合い', 'はなしあい', '{話|はな}し{合|あ}い'],
    ['テレビ', 'テレビ', 'テレビ'],
  ])('%s（%s）→ %s', (word, reading, expected) => {
    expect(alignRuby(word, reading)).toBe(expected);
  });

  it('falls back to annotating the whole word', () => {
    expect(alignRuby('取り消す', 'まったくちがう')).toBe('{取り消す|まったくちがう}');
  });
});

describe('kana helpers', () => {
  it('converts between scripts', () => {
    expect(toHiragana('カタカナ')).toBe('かたかな');
    expect(toKatakana('ひらがな')).toBe('ヒラガナ');
    expect(toHiragana('コーヒー')).toBe('こーひー');
  });

  it('detects kana-only words and strips kun markers', () => {
    expect(isKanaOnly('ありがとう')).toBe(true);
    expect(isKanaOnly('コーヒー')).toBe(true);
    expect(isKanaOnly('お茶')).toBe(false);
    expect(kunPlain('まな.ぶ')).toBe('まなぶ');
  });
});

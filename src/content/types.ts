/**
 * Content model. Every learnable thing is an `Item` with a stable id, a JLPT-style level
 * and a difficulty `d` on a 0–1000 scale (see `engine/levels.ts` for the level bands).
 *
 * Japanese text that needs furigana uses ruby notation: `{漢字|かんじ}`.
 */

/** `kana` is the pre-N5 stage: hiragana and katakana. */
export type Level = 'kana' | 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
export const LEVELS: readonly Level[] = ['kana', 'N5', 'N4', 'N3', 'N2', 'N1'];

export type ItemType = 'kana' | 'vocab' | 'kanji' | 'grammar' | 'trap';
export const ITEM_TYPES: readonly ItemType[] = ['kana', 'vocab', 'kanji', 'grammar', 'trap'];

/** Ability is tracked per skill. Trap (false-friend) items count toward vocab. */
export type Skill = 'kana' | 'vocab' | 'kanji' | 'grammar';
export const SKILLS: readonly Skill[] = ['kana', 'vocab', 'kanji', 'grammar'];

export type Pos =
  | 'n'
  | 'pron'
  | 'num'
  | 'ctr'
  | 'v1'
  | 'v5'
  | 'vs'
  | 'vk'
  | 'vz'
  | 'adj-i'
  | 'adj-na'
  | 'adn'
  | 'adv'
  | 'conj'
  | 'int'
  | 'exp'
  | 'prt'
  | 'pref'
  | 'suf';

export const POS_LABEL: Record<Pos, string> = {
  n: '名詞',
  pron: '代名詞',
  num: '數詞',
  ctr: '助數詞',
  v1: '一段動詞',
  v5: '五段動詞',
  vs: 'する動詞',
  vk: 'カ變動詞',
  vz: 'サ變動詞',
  'adj-i': 'い形容詞',
  'adj-na': 'な形容詞',
  adn: '連體詞',
  adv: '副詞',
  conj: '接續詞',
  int: '感嘆詞',
  exp: '慣用表現',
  prt: '助詞',
  pref: '接頭語',
  suf: '接尾語',
};

/** A Japanese sentence (ruby notation) with its Traditional Chinese translation. */
export interface Example {
  ja: string;
  zh: string;
  /** Set when the sentence comes from Tatoeba, whose license (CC BY 2.0 FR) requires crediting it. */
  source?: ExampleSource;
}

/** A Tatoeba sentence: its id and author, and the same for the Chinese when that came from Tatoeba too. */
export interface ExampleSource {
  id: number;
  author?: string;
  zhId?: number;
  zhAuthor?: string;
}

interface ItemBase {
  id: string;
  level: Level;
  /** Difficulty, 0–1000. Increases with level and with curriculum order inside a level. */
  d: number;
}

export interface KanaItem extends ItemBase {
  type: 'kana';
  kana: string;
  romaji: string;
  script: 'hiragana' | 'katakana';
  group: 'basic' | 'dakuten' | 'handakuten' | 'yoon';
  /** The kanji the kana developed from (字源), e.g. あ ← 安. */
  origin?: string;
  note?: string;
}

export interface VocabItem extends ItemBase {
  type: 'vocab';
  word: string;
  reading: string;
  /** `word` in ruby notation, e.g. `{食|た}べる`. Equals `word` for kana-only words. */
  ruby: string;
  meaning: string;
  pos: Pos;
  example?: Example;
  note?: string;
}

export interface KanjiWord {
  word: string;
  reading: string;
  meaning: string;
}

export interface KanjiItem extends ItemBase {
  type: 'kanji';
  kanji: string;
  /** Traditional Chinese form, only when it differs from the Japanese form (学 → 學). */
  trad?: string;
  /** On'yomi in katakana. */
  on: string[];
  /** Kun'yomi in hiragana; okurigana after a dot (まな.ぶ). */
  kun: string[];
  meaning: string;
  words: KanjiWord[];
  note?: string;
}

/** Fill-in-the-blank question. `ja` contains exactly one blank (＿＿). */
export interface GrammarQuiz {
  ja: string;
  answer: string;
  distractors: string[];
  zh?: string;
}

export interface GrammarItem extends ItemBase {
  type: 'grammar';
  pattern: string;
  meaning: string;
  /** How to attach the pattern (接續), e.g. 動詞て形 + もいい. */
  form?: string;
  explain: string;
  examples: Example[];
  quizzes: GrammarQuiz[];
}

/** Same characters, different meaning in Japanese and Chinese (中日同形異義). */
export interface TrapItem extends ItemBase {
  type: 'trap';
  word: string;
  reading: string;
  ruby: string;
  /** What it means in Japanese. */
  meaning: string;
  /** What a Chinese reader would wrongly guess. */
  trap: string;
  example?: Example;
}

export type Item = KanaItem | VocabItem | KanjiItem | GrammarItem | TrapItem;

export const BLANK = '＿＿';

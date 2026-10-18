import { KANA_ITEMS, KANJI_ITEMS, TRAP_ITEMS, VOCAB_ITEMS } from '../content';
import { CONFUSABLE_KANA } from '../content/kana';
import { hasKanji, isKatakana, kunPlain, rubyBase, toKatakana } from '../content/text';
import { LEVELS, type Item, type KanaItem, type KanjiItem, type Level, type VocabItem } from '../content/types';
import { pickOne, shuffle, type Rng } from './random';

export type ExerciseKind =
  | 'intro'
  | 'kana_read'
  | 'kana_pick'
  | 'kana_listen'
  | 'vocab_meaning'
  | 'vocab_reading'
  | 'vocab_word'
  | 'vocab_listen'
  | 'kanji_meaning'
  | 'kanji_reading'
  | 'kanji_form'
  | 'grammar_cloze'
  | 'trap_meaning';

/** intro = teaching card; check = first quiz after an intro; review = SRS; retry = missed earlier in the block. */
export type StepRole = 'intro' | 'check' | 'review' | 'retry';

/** Which script the answer options are in — decides the font (Japanese vs Traditional Chinese glyphs). */
export type Script = 'ja' | 'zh' | 'latin';

export interface Step {
  id: string;
  itemId: string;
  kind: ExerciseKind;
  role: StepRole;
  options?: string[];
  answer?: number;
  script?: Script;
  /** grammar_cloze: index of the quiz sentence. kanji_reading: which reading is asked. */
  variant?: number | 'on' | 'kun';
}

export const LISTENING_KINDS: ReadonlySet<ExerciseKind> = new Set<ExerciseKind>(['kana_listen', 'vocab_listen']);

/**
 * Every listening exercise has a silent twin with the same answer options, so turning the
 * sound off in the middle of a block just changes how the current question is shown.
 */
export function playableKind(kind: ExerciseKind, sound: boolean): ExerciseKind {
  if (sound) return kind;
  if (kind === 'kana_listen') return 'kana_pick';
  if (kind === 'vocab_listen') return 'vocab_meaning';
  return kind;
}

/** Answers slower than this count as "hard" for scheduling. */
export const SLOW_MS: Record<ExerciseKind, number> = {
  intro: 0,
  kana_read: 6000,
  kana_pick: 6000,
  kana_listen: 7000,
  vocab_meaning: 8000,
  vocab_reading: 9000,
  vocab_word: 9000,
  vocab_listen: 9000,
  kanji_meaning: 8000,
  kanji_reading: 9000,
  kanji_form: 8000,
  grammar_cloze: 15000,
  trap_meaning: 10000,
};

export function instruction(kind: ExerciseKind, variant?: Step['variant']): string {
  switch (kind) {
    case 'intro':
      return '新內容';
    case 'kana_read':
      return '這個假名怎麼唸？';
    case 'kana_pick':
      return '選出對應的假名';
    case 'kana_listen':
      return '聽發音，選出假名';
    case 'vocab_meaning':
      return '這個單字是什麼意思？';
    case 'vocab_reading':
      return '這個單字怎麼唸？';
    case 'vocab_word':
      return '日文怎麼說？';
    case 'vocab_listen':
      return '聽發音，選出意思';
    case 'kanji_meaning':
      return '這個漢字是什麼意思？';
    case 'kanji_reading':
      return variant === 'kun' ? '這個漢字的訓讀是？' : '這個漢字的音讀是？';
    case 'kanji_form':
      return '這個日文漢字的繁體字是？';
    case 'grammar_cloze':
      return '選出最適合填入空格的答案';
    case 'trap_meaning':
      return '小心陷阱！這個詞在日文是什麼意思？';
  }
}

/** Exercise used right after an item is introduced. */
export function checkKind(item: Item, sound: boolean, rng: Rng): ExerciseKind {
  switch (item.type) {
    case 'kana':
      return sound ? 'kana_listen' : 'kana_read';
    case 'vocab':
      if (sound && rng() < 0.5) return 'vocab_listen';
      // Chinese speakers can usually guess a kanji word's meaning; the reading is the real test.
      return hasKanji(item.word) ? 'vocab_reading' : 'vocab_meaning';
    case 'kanji':
      return 'kanji_reading';
    case 'grammar':
      return 'grammar_cloze';
    case 'trap':
      return 'trap_meaning';
  }
}

/** Review exercises rotate through several angles on the same item. */
export function reviewKind(item: Item, reps: number, sound: boolean): ExerciseKind {
  let kinds: ExerciseKind[];
  switch (item.type) {
    case 'kana':
      kinds = sound ? ['kana_read', 'kana_listen', 'kana_pick'] : ['kana_read', 'kana_pick'];
      break;
    case 'vocab':
      // 学校 → 學校 gives itself away both ways, so only the reading (and listening) is tested.
      kinds = !hasKanji(item.word)
        ? ['vocab_meaning', 'vocab_word']
        : glossNamesItself(item.word, item.meaning)
          ? ['vocab_reading']
          : ['vocab_reading', 'vocab_word', 'vocab_meaning'];
      if (sound) kinds.splice(1, 0, 'vocab_listen');
      break;
    case 'kanji':
      kinds = item.trad ? ['kanji_reading', 'kanji_form'] : ['kanji_reading'];
      if (!glossNamesItself(item.kanji, item.meaning)) kinds.push('kanji_meaning');
      break;
    case 'grammar':
      kinds = ['grammar_cloze'];
      break;
    case 'trap':
      kinds = ['trap_meaning'];
      break;
  }
  return kinds[reps % kinds.length];
}

// ---------------------------------------------------------------------------
// Distractors

type Question = { options: string[]; answer: number; script: Script; variant?: Step['variant'] };

function choice(correct: string, distractors: readonly string[], script: Script, rng: Rng, variant?: Step['variant']): Question {
  const options = shuffle([correct, ...distractors.slice(0, 3)], rng);
  return { options, answer: options.indexOf(correct), script, variant };
}

/** Takes up to `n` distinct strings, trying each tier (in random order) before the next. */
function fill(tiers: readonly (readonly string[])[], n: number, reject: (s: string) => boolean, rng: Rng): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    if (out.length >= n) break;
    for (const s of shuffle(tier, rng)) {
      if (out.length >= n) break;
      if (!s || seen.has(s) || reject(s)) continue;
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

const SENSE_SPLIT = /[；;、，,／/]/;

/** True when two glosses share a sense ("學生" vs "學生；學員"), so both could be right. */
export function meaningsClash(a: string, b: string): boolean {
  if (a === b) return true;
  const sa = a.split(SENSE_SPLIT).map((s) => s.trim()).filter(Boolean);
  const sb = new Set(b.split(SENSE_SPLIT).map((s) => s.trim()).filter(Boolean));
  return sa.some((s) => sb.has(s));
}

/** 新字體 → 繁體 (学 → 學), for comparing Japanese words with Chinese glosses. */
const TRAD: ReadonlyMap<string, string> = new Map(KANJI_ITEMS.flatMap((k) => (k.trad ? [[k.kanji, k.trad] as const] : [])));

/**
 * True when one sense of the Chinese gloss is the Japanese word itself, in either form
 * (学校 → 「學校」, 時間 → 「時間；小時」). Asking such a meaning tests nothing for Chinese speakers.
 */
export function glossNamesItself(word: string, gloss: string): boolean {
  const trad = [...word].map((ch) => TRAD.get(ch) ?? ch).join('');
  return gloss.split(SENSE_SPLIT).some((s) => s.trim() === word || s.trim() === trad);
}

function nearbyLevels(level: Level): Set<Level> {
  const i = LEVELS.indexOf(level);
  return new Set(LEVELS.slice(Math.max(0, i - 1), i + 2));
}

// Near-miss readings target the mistakes Chinese speakers make most: long vowels (長音),
// the small っ (促音), voiced vs voiceless (清濁音) and small ゃゅょ (拗音).
const VOICE: Record<string, string> = {};
for (const pair of 'かが きぎ くぐ けげ こご さざ しじ すず せぜ そぞ ただ ちぢ つづ てで とど はば ひび ふぶ へべ ほぼ'.split(' ')) {
  const [a, b] = [...pair];
  VOICE[a] = b;
  VOICE[b] = a;
  VOICE[toKatakana(a)] = toKatakana(b);
  VOICE[toKatakana(b)] = toKatakana(a);
}
for (const [p, b] of [['ぱ', 'ば'], ['ぴ', 'び'], ['ぷ', 'ぶ'], ['ぺ', 'べ'], ['ぽ', 'ぼ']]) {
  VOICE[p] = b;
  VOICE[toKatakana(p)] = toKatakana(b);
}
const SMALL: Record<string, string> = {
  ゃ: 'や', ゅ: 'ゆ', ょ: 'よ', や: 'ゃ', ゆ: 'ゅ', よ: 'ょ',
  ャ: 'ヤ', ュ: 'ユ', ョ: 'ヨ', ヤ: 'ャ', ユ: 'ュ', ヨ: 'ョ',
};
const O_SOUND = new Set([...'おこごそぞとどのほぼぽもよょろをオコゴソゾトドノホボポモヨョロ']);
const U_SOUND = new Set([...'うくぐすずつづぬふぶぷむゆゅるウクグスズツヅヌフブプムユュル']);
const E_SOUND = new Set([...'えけげせぜてでねへべぺめれエケゲセゼテデネヘベペメレ']);
const GEMINABLE = new Set([...'かきくけこさしすせそたちつてとぱぴぷぺぽカキクケコサシスセソタチツテトパピプペポ']);
const NO_GEMINATE_AFTER = new Set([...'っッんンー']);

/** Plausible but wrong variants of a kana reading. */
export function readingMutations(reading: string): string[] {
  const chars = [...reading];
  const out = new Set<string>();
  const katakanaWord = chars.every((c) => isKatakana(c) || c === 'ー');
  const replaceAt = (i: number, c: string) => out.add([...chars.slice(0, i), c, ...chars.slice(i + 1)].join(''));
  const removeAt = (i: number) => out.add([...chars.slice(0, i), ...chars.slice(i + 1)].join(''));
  const insertAt = (i: number, c: string) => out.add([...chars.slice(0, i), c, ...chars.slice(i)].join(''));

  chars.forEach((c, i) => {
    const prev = chars[i - 1];
    const next = chars[i + 1];
    if (VOICE[c]) replaceAt(i, VOICE[c]);
    if (SMALL[c] && i > 0) replaceAt(i, SMALL[c]);
    if (c === 'っ' || c === 'ッ') removeAt(i);
    if (i > 0 && GEMINABLE.has(c) && !NO_GEMINATE_AFTER.has(prev)) insertAt(i, katakanaWord ? 'ッ' : 'っ');
    const longVowel =
      c === 'ー' || (c === 'う' && (O_SOUND.has(prev) || U_SOUND.has(prev))) || (c === 'い' && E_SOUND.has(prev));
    if (i > 0 && longVowel) removeAt(i);
    if (katakanaWord) {
      if (isKatakana(c) && next !== 'ー' && !SMALL[next] && c !== 'ッ' && c !== 'ン') insertAt(i + 1, 'ー');
    } else if (O_SOUND.has(c) && next !== 'う' && next !== 'お' && !SMALL[next]) {
      insertAt(i + 1, 'う');
    }
  });
  out.delete(reading);
  return [...out];
}

function kanaQuestion(item: KanaItem, kind: ExerciseKind, rng: Rng): Question {
  const sameScript = KANA_ITEMS.filter((k) => k.script === item.script);
  const sameGroup = sameScript.filter((k) => k.group === item.group);
  if (kind === 'kana_read') {
    const distractors = fill(
      [sameGroup.map((k) => k.romaji), sameScript.map((k) => k.romaji)],
      3,
      (r) => r === item.romaji,
      rng,
    );
    return choice(item.romaji, distractors, 'latin', rng);
  }
  const confusable = CONFUSABLE_KANA.filter((g) => g.includes(item.kana)).flat();
  const sameSound = new Set(KANA_ITEMS.filter((k) => k.romaji === item.romaji).map((k) => k.kana));
  const distractors = fill(
    [confusable, sameGroup.map((k) => k.kana), sameScript.map((k) => k.kana)],
    3,
    (k) => sameSound.has(k),
    rng,
  );
  return choice(item.kana, distractors, 'ja', rng);
}

function vocabQuestion(item: VocabItem, kind: ExerciseKind, rng: Rng): Question {
  const near = nearbyLevels(item.level);
  const others = VOCAB_ITEMS.filter((v) => v.id !== item.id);
  const nearby = others.filter((v) => near.has(v.level));
  const samePos = nearby.filter((v) => v.pos === item.pos);

  if (kind === 'vocab_meaning' || kind === 'vocab_listen') {
    const distractors = fill(
      [samePos.map((v) => v.meaning), nearby.map((v) => v.meaning), others.map((v) => v.meaning)],
      3,
      (m) => meaningsClash(m, item.meaning),
      rng,
    );
    return choice(item.meaning, distractors, 'zh', rng);
  }
  if (kind === 'vocab_word') {
    const clash = new Set(others.filter((v) => meaningsClash(v.meaning, item.meaning)).map((v) => v.word));
    const distractors = fill(
      [samePos.map((v) => v.word), nearby.map((v) => v.word), others.map((v) => v.word)],
      3,
      (w) => w === item.word || clash.has(w),
      rng,
    );
    return choice(item.word, distractors, 'ja', rng);
  }
  // vocab_reading: up to two near misses, the rest real readings of similar length.
  const sameWord = new Set(others.filter((v) => v.word === item.word).map((v) => v.reading));
  const nearMiss = shuffle(readingMutations(item.reading), rng)
    .filter((r) => !sameWord.has(r))
    .slice(0, 2);
  const len = [...item.reading].length;
  const similar = nearby.filter((v) => Math.abs([...v.reading].length - len) <= 1).map((v) => v.reading);
  const rest = fill(
    [similar, others.map((v) => v.reading)],
    3 - nearMiss.length,
    (r) => r === item.reading || nearMiss.includes(r) || sameWord.has(r),
    rng,
  );
  return choice(item.reading, [...nearMiss, ...rest], 'ja', rng);
}

function kanjiQuestion(item: KanjiItem, kind: ExerciseKind, rng: Rng): Question {
  const others = KANJI_ITEMS.filter((k) => k.id !== item.id);
  const sameLevel = others.filter((k) => k.level === item.level);

  if (kind === 'kanji_form' && item.trad) {
    const distractors = fill(
      [sameLevel.flatMap((k) => (k.trad ? [k.trad] : [])), others.flatMap((k) => (k.trad ? [k.trad] : []))],
      3,
      (t) => t === item.trad || t === item.kanji,
      rng,
    );
    return choice(item.trad, distractors, 'zh', rng);
  }
  if (kind === 'kanji_reading' && (item.on.length > 0 || item.kun.length > 0)) {
    const useKun = item.on.length === 0 || (item.kun.length > 0 && rng() < 0.35);
    const own = new Set([...item.on, ...item.kun.map(kunPlain)]);
    const correct = useKun ? kunPlain(pickOne(item.kun, rng)) : pickOne(item.on, rng);
    const readingsOf = (k: KanjiItem) => (useKun ? k.kun.map(kunPlain) : k.on);
    const nearMiss = shuffle(readingMutations(correct), rng).filter((r) => !own.has(r)).slice(0, 1);
    const rest = fill(
      [sameLevel.flatMap(readingsOf), others.flatMap(readingsOf)],
      3 - nearMiss.length,
      (r) => own.has(r) || nearMiss.includes(r),
      rng,
    );
    return choice(correct, [...nearMiss, ...rest], 'ja', rng, useKun ? 'kun' : 'on');
  }
  const distractors = fill(
    [sameLevel.map((k) => k.meaning), others.map((k) => k.meaning)],
    3,
    (m) => meaningsClash(m, item.meaning),
    rng,
  );
  return choice(item.meaning, distractors, 'zh', rng);
}

/** Builds the options for a quiz step. `reps` rotates grammar quiz sentences across reviews. */
export function buildQuestion(item: Item, kind: ExerciseKind, rng: Rng, reps = 0): Question {
  switch (item.type) {
    case 'kana':
      return kanaQuestion(item, kind, rng);
    case 'vocab':
      return vocabQuestion(item, kind, rng);
    case 'kanji':
      return kanjiQuestion(item, kind, rng);
    case 'grammar': {
      const index = reps % item.quizzes.length;
      const quiz = item.quizzes[index];
      return choice(quiz.answer, quiz.distractors, 'ja', rng, index);
    }
    case 'trap': {
      const pool = TRAP_ITEMS.filter((t) => t.id !== item.id).map((t) => t.meaning);
      const rest = fill([pool], 2, (m) => meaningsClash(m, item.meaning) || meaningsClash(m, item.trap), rng);
      return choice(item.meaning, [item.trap, ...rest], 'zh', rng);
    }
  }
}

export function makeStep(item: Item, kind: ExerciseKind, role: StepRole, id: string, rng: Rng, reps = 0): Step {
  if (kind === 'intro') return { id, itemId: item.id, kind, role };
  return { id, itemId: item.id, kind, role, ...buildQuestion(item, kind, rng, reps) };
}

/** Same question with the options in a new order, for re-asking a missed item. */
export function reshuffled(step: Step, id: string, rng: Rng): Step {
  if (!step.options || step.answer === undefined) return { ...step, id, role: 'retry' };
  const correct = step.options[step.answer];
  const options = shuffle(step.options, rng);
  return { ...step, id, role: 'retry', options, answer: options.indexOf(correct) };
}

/**
 * What to pronounce for an item. Words are spoken from their kana reading so the speech
 * engine cannot misread the kanji; sentences keep their kanji so particles sound natural.
 */
export function speechFor(item: Item): string {
  switch (item.type) {
    case 'kana':
      return item.kana;
    case 'vocab':
    case 'trap':
      return item.reading;
    case 'kanji':
      return item.words[0]?.reading ?? item.on[0] ?? kunPlain(item.kun[0] ?? item.kanji);
    case 'grammar':
      return rubyBase(item.examples[0]?.ja ?? item.pattern);
  }
}

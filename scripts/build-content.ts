/**
 * Builds src/content/data/*.json from the human-editable sources in /content.
 *
 *   npm run build:content
 *
 * The sources are spreadsheet-friendly TSV files (plus a small text format for grammar);
 * see content/README.md. This script validates everything, assigns stable ids and
 * difficulties, and fails with a list of problems instead of writing bad data.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import subsetFont from 'subset-font';

import { alignRuby, hasKanji, isHiragana, isKana, isKatakana, parseRuby } from '../src/content/text';
import {
  BLANK,
  LEVELS,
  POS_LABEL,
  type Example,
  type GrammarItem,
  type GrammarQuiz,
  type KanjiItem,
  type KanjiWord,
  type Level,
  type Pos,
  type TrapItem,
  type VocabItem,
} from '../src/content/types';
import { LEVEL_BANDS } from '../src/engine/levels';

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'content');
const OUT = join(ROOT, 'src', 'content', 'data');
const STUDY_LEVELS = LEVELS.filter((l): l is Exclude<Level, 'kana'> => l !== 'kana');

const errors: string[] = [];
const warnings: string[] = [];

interface Row {
  file: string;
  line: number;
  cols: string[];
}

function readTsv(file: string): Row[] {
  if (!existsSync(file)) return [];
  const text = readFileSync(file, 'utf8').replace(/^﻿/, '');
  return text.split(/\r?\n/).flatMap((raw, i) => {
    if (!raw.trim() || raw.trimStart().startsWith('#')) return [];
    return [{ file: file.slice(ROOT.length + 1), line: i + 1, cols: raw.split('\t').map((c) => c.trim()) }];
  });
}

const at = (row: { file: string; line: number }) => `${row.file}:${row.line}`;

/** Spreads items of one level evenly across the level's difficulty band, in file order. */
function difficulty(level: Level, index: number, count: number): number {
  const [lo, hi] = LEVEL_BANDS[level];
  const t = count <= 1 ? 0.5 : index / (count - 1);
  return Math.round(lo + (hi - lo) * (0.04 + 0.92 * t));
}

const isReading = (s: string) => s.length > 0 && [...s].every((c) => isKana(c) || c === 'ー');

function checkRuby(text: string, where: string): void {
  for (const seg of parseRuby(text)) {
    if (!seg.ruby && /[{}|]/.test(seg.text)) errors.push(`${where}: broken ruby notation in "${text}"`);
    if (seg.ruby && !isReading(seg.ruby)) errors.push(`${where}: ruby "${seg.ruby}" is not kana`);
  }
}

/** `tatoeba:123:author zh:456:author` or `tatoeba:123:author zh:ai` (Chinese not from Tatoeba). */
const SOURCE = /^tatoeba:(\d+):(\S*) zh:(?:(\d+):(\S*)|ai)$/;

function example(ja: string | undefined, zh: string | undefined, where: string, source?: string): Example | undefined {
  if (!ja) return undefined;
  if (!zh) {
    errors.push(`${where}: example has no translation`);
    return undefined;
  }
  checkRuby(ja, where);
  if (!source) return { ja, zh };
  const m = SOURCE.exec(source);
  if (!m) {
    errors.push(`${where}: bad example source "${source}" (use tatoeba:<id>:<author> zh:<id>:<author> or zh:ai)`);
    return { ja, zh };
  }
  const [, id, author, zhId, zhAuthor] = m;
  return {
    ja,
    zh,
    source: {
      id: Number(id),
      ...(author && { author }),
      ...(zhId && { zhId: Number(zhId) }),
      ...(zhAuthor && { zhAuthor }),
    },
  };
}

// ---------------------------------------------------------------------------

function buildVocab(): VocabItem[] {
  const out: VocabItem[] = [];
  const seen = new Map<string, string>();
  for (const level of STUDY_LEVELS) {
    const rows = readTsv(join(SRC, 'vocab', `${level.toLowerCase()}.tsv`));
    const kept: Omit<VocabItem, 'd'>[] = [];
    for (const row of rows) {
      const [word, reading, meaning, pos, exJa, exZh, note, exSource] = row.cols;
      const where = at(row);
      if (!word || !reading || !meaning || !pos) {
        errors.push(`${where}: vocab needs word, reading, meaning, pos`);
        continue;
      }
      if (!isReading(reading)) errors.push(`${where}: reading "${reading}" must be kana`);
      if (!(pos in POS_LABEL)) errors.push(`${where}: unknown pos "${pos}"`);
      const key = `${word}:${reading}`;
      if (seen.has(key)) {
        warnings.push(`${where}: ${word}（${reading}）already in ${seen.get(key)}, skipped`);
        continue;
      }
      seen.set(key, where);
      const ruby = alignRuby(word, reading);
      if (hasKanji(word) && ruby === `{${word}|${reading}}` && [...word].some(isKana)) {
        warnings.push(`${where}: could not align reading for ${word}（${reading}）`);
      }
      kept.push({
        id: `v:${key}`,
        type: 'vocab',
        level,
        word,
        reading,
        ruby,
        meaning,
        pos: pos as Pos,
        example: example(exJa, exZh, where, exSource),
        note: note || undefined,
      });
    }
    kept.forEach((item, i) => out.push({ ...item, d: difficulty(level, i, kept.length) }));
  }
  return out;
}

function splitList(s: string | undefined): string[] {
  if (!s || s === '-') return [];
  return s
    .split(/[,、]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildKanji(): KanjiItem[] {
  const out: KanjiItem[] = [];
  const seen = new Map<string, string>();
  for (const level of STUDY_LEVELS) {
    const rows = readTsv(join(SRC, 'kanji', `${level.toLowerCase()}.tsv`));
    const kept: Omit<KanjiItem, 'd'>[] = [];
    for (const row of rows) {
      const [kanji, trad, onRaw, kunRaw, meaning, wordsRaw, note] = row.cols;
      const where = at(row);
      if (!kanji || !meaning) {
        errors.push(`${where}: kanji needs kanji and meaning`);
        continue;
      }
      if ([...kanji].length !== 1) errors.push(`${where}: "${kanji}" is not a single character`);
      if (seen.has(kanji)) {
        warnings.push(`${where}: ${kanji} already in ${seen.get(kanji)}, skipped`);
        continue;
      }
      seen.set(kanji, where);
      const tradForm = trad && trad !== '-' ? trad : undefined;
      if (tradForm && ([...tradForm].length !== 1 || tradForm === kanji)) {
        errors.push(`${where}: traditional form "${tradForm}" must be one different character`);
      }
      const on = splitList(onRaw);
      const kun = splitList(kunRaw);
      for (const r of on) if (![...r].every((c) => isKatakana(c))) errors.push(`${where}: on'yomi "${r}" must be katakana`);
      for (const r of kun) {
        if (![...r.replace(/[.\-]/g, '')].every((c) => isHiragana(c))) {
          errors.push(`${where}: kun'yomi "${r}" must be hiragana`);
        }
      }
      if (on.length + kun.length === 0) errors.push(`${where}: ${kanji} has no readings`);
      const words: KanjiWord[] = [];
      for (const w of (wordsRaw ?? '').split('/').map((s) => s.trim()).filter(Boolean)) {
        const [word, reading, wordMeaning] = w.split(':').map((s) => s.trim());
        if (!word || !reading || !wordMeaning || !isReading(reading)) {
          errors.push(`${where}: bad example word "${w}" (use 語:よみ:意思)`);
          continue;
        }
        if (!word.includes(kanji)) warnings.push(`${where}: example ${word} does not contain ${kanji}`);
        words.push({ word, reading, meaning: wordMeaning });
      }
      kept.push({ id: `k:${kanji}`, type: 'kanji', level, kanji, trad: tradForm, on, kun, meaning, words, note: note || undefined });
    }
    kept.forEach((item, i) => out.push({ ...item, d: difficulty(level, i, kept.length) }));
  }
  return out;
}

/**
 * Grammar source format (one block per point):
 *
 *   @ n5-te-mo-ii
 *   pattern: 〜てもいい
 *   meaning: 可以～（許可）
 *   form: 動詞て形 + もいい
 *   explain: …
 *   ex: {写真|しゃしん}を{撮|と}ってもいいですか。 = 可以拍照嗎？
 *   q: ここで{写真|しゃしん}を{撮|と}って＿＿いいですか。 = も | は | が | を = 可以在這裡拍照嗎？
 */
function buildGrammar(): GrammarItem[] {
  const out: GrammarItem[] = [];
  const ids = new Set<string>();
  for (const level of STUDY_LEVELS) {
    const file = join(SRC, 'grammar', `${level.toLowerCase()}.txt`);
    if (!existsSync(file)) continue;
    const rel = file.slice(ROOT.length + 1);
    const lines = readFileSync(file, 'utf8').replace(/^﻿/, '').split(/\r?\n/);
    type Draft = Partial<GrammarItem> & { examples: Example[]; quizzes: GrammarQuiz[]; line: number };
    const drafts: Draft[] = [];
    let cur: Draft | undefined;
    lines.forEach((raw, i) => {
      const line = raw.trim();
      const where = `${rel}:${i + 1}`;
      if (!line || line.startsWith('#')) return;
      if (line.startsWith('@')) {
        cur = { id: `g:${line.slice(1).trim()}`, examples: [], quizzes: [], line: i + 1 };
        drafts.push(cur);
        return;
      }
      if (!cur) {
        errors.push(`${where}: text before the first "@ id" line`);
        return;
      }
      const colon = line.indexOf(':');
      const key = line.slice(0, colon).trim();
      const value = line.slice(colon + 1).trim();
      if (colon < 0 || !value) {
        errors.push(`${where}: expected "key: value"`);
        return;
      }
      if (key === 'pattern' || key === 'meaning' || key === 'form' || key === 'explain') {
        cur[key] = value;
      } else if (key === 'ex') {
        const [ja, zh] = value.split(' = ').map((s) => s.trim());
        const ex = example(ja, zh, where);
        if (ex) cur.examples.push(ex);
      } else if (key === 'q') {
        const [ja, opts, zh] = value.split(' = ').map((s) => s.trim());
        const [answer, ...distractors] = (opts ?? '').split(' | ').map((s) => s.trim());
        if (!ja || !answer) {
          errors.push(`${where}: quiz needs "sentence = answer | wrong | wrong | wrong"`);
          return;
        }
        if (ja.split(BLANK).length !== 2) errors.push(`${where}: quiz needs exactly one ${BLANK}`);
        if (distractors.length !== 3) errors.push(`${where}: quiz needs 3 wrong options, got ${distractors.length}`);
        if (distractors.includes(answer)) errors.push(`${where}: answer "${answer}" is also a wrong option`);
        if (new Set(distractors).size !== distractors.length) errors.push(`${where}: duplicate wrong options`);
        checkRuby(ja, where);
        cur.quizzes.push({ ja, answer, distractors, zh: zh || undefined });
      } else {
        errors.push(`${where}: unknown key "${key}"`);
      }
    });
    const kept: Omit<GrammarItem, 'd'>[] = [];
    for (const g of drafts) {
      const where = `${rel}:${g.line}`;
      if (ids.has(g.id!)) errors.push(`${where}: duplicate grammar id ${g.id}`);
      ids.add(g.id!);
      if (!g.pattern || !g.meaning || !g.explain) errors.push(`${where}: ${g.id} needs pattern, meaning, explain`);
      if (g.examples.length === 0) errors.push(`${where}: ${g.id} has no examples`);
      if (g.quizzes.length === 0) errors.push(`${where}: ${g.id} has no quizzes`);
      kept.push({
        id: g.id!,
        type: 'grammar',
        level,
        pattern: g.pattern ?? '',
        meaning: g.meaning ?? '',
        form: g.form,
        explain: g.explain ?? '',
        examples: g.examples,
        quizzes: g.quizzes,
      });
    }
    kept.forEach((item, i) => out.push({ ...item, d: difficulty(level, i, kept.length) }));
  }
  return out;
}

function buildTraps(): TrapItem[] {
  const rows = readTsv(join(SRC, 'traps.tsv'));
  const byLevel = new Map<Level, Omit<TrapItem, 'd'>[]>();
  const seen = new Set<string>();
  for (const row of rows) {
    const [word, reading, levelRaw, meaning, trap, exJa, exZh] = row.cols;
    const where = at(row);
    const level = levelRaw as Level;
    if (!word || !reading || !meaning || !trap || !STUDY_LEVELS.includes(level as Exclude<Level, 'kana'>)) {
      errors.push(`${where}: trap needs word, reading, level (N5–N1), meaning, trap`);
      continue;
    }
    if (!isReading(reading)) errors.push(`${where}: reading "${reading}" must be kana`);
    if (seen.has(word)) {
      errors.push(`${where}: duplicate trap ${word}`);
      continue;
    }
    seen.add(word);
    const list = byLevel.get(level) ?? [];
    list.push({
      id: `t:${word}`,
      type: 'trap',
      level,
      word,
      reading,
      ruby: alignRuby(word, reading),
      meaning,
      trap,
      example: example(exJa, exZh, where),
    });
    byLevel.set(level, list);
  }
  const out: TrapItem[] = [];
  for (const level of STUDY_LEVELS) {
    const list = byLevel.get(level) ?? [];
    list.forEach((item, i) => out.push({ ...item, d: difficulty(level, i, list.length) }));
  }
  return out;
}

function write(name: string, items: object[]): void {
  // One item per line: compact, but still readable in diffs.
  const body = items.map((item) => JSON.stringify(item)).join(',\n');
  writeFileSync(join(OUT, `${name}.json`), `[\n${body}\n]\n`);
}

// ---------------------------------------------------------------------------
// Japanese font subset for Android.
//
// iOS ships Hiragino Sans, but Android picks CJK glyphs by system locale, so on a Traditional
// Chinese phone 直・骨・述… would be drawn in their Chinese forms. The app therefore bundles
// Noto Sans JP (SIL OFL 1.1), cut down to the characters it actually shows in Japanese.

const FONT_SRC = join(ROOT, 'node_modules', '@expo-google-fonts', 'noto-sans-jp');
const FONT_OUT = join(ROOT, 'assets', 'fonts');
const FONT_WEIGHTS = [
  { src: join('400Regular', 'NotoSansJP_400Regular.ttf'), out: 'NotoSansJP-Regular.ttf' },
  { src: join('700Bold', 'NotoSansJP_700Bold.ttf'), out: 'NotoSansJP-Bold.ttf' },
];
/** Japanese text in the UI itself (everything else comes from the content). */
const UI_JAPANESE = 'スキマ日語すごい！お疲れさま！がんばろう！';

function range(from: number, to: number): string {
  let s = '';
  for (let c = from; c <= to; c++) s += String.fromCodePoint(c);
  return s;
}

function japaneseCharacters(): string {
  const parts: string[] = [
    range(0x20, 0x7e), // ASCII
    range(0x3000, 0x303f), // CJK punctuation 、。「」〜
    range(0x3041, 0x30ff), // hiragana and katakana
    range(0xff01, 0xff5e), // full-width forms （）！？＿
    UI_JAPANESE,
  ];
  for (const v of [...vocab, ...traps]) parts.push(v.word, v.reading, v.example?.ja ?? '');
  for (const k of kanji) parts.push(k.kanji, ...k.on, ...k.kun, ...k.words.flatMap((w) => [w.word, w.reading]));
  for (const g of grammar) {
    parts.push(g.pattern, g.form ?? '', ...g.examples.map((e) => e.ja));
    for (const q of g.quizzes) parts.push(q.ja, q.answer, ...q.distractors);
  }
  return [...new Set([...parts.join('')])].sort().join('');
}

async function buildFonts(): Promise<void> {
  if (!existsSync(FONT_SRC)) {
    console.warn('warning: @expo-google-fonts/noto-sans-jp not installed; Android font subset not updated');
    return;
  }
  const chars = japaneseCharacters();
  const manifest = join(FONT_OUT, 'NotoSansJP.chars.txt');
  const upToDate =
    existsSync(manifest) &&
    readFileSync(manifest, 'utf8') === chars &&
    FONT_WEIGHTS.every((f) => existsSync(join(FONT_OUT, f.out)));
  if (upToDate) {
    console.log(`font   ${[...chars].length} characters, subset unchanged`);
    return;
  }
  mkdirSync(FONT_OUT, { recursive: true });
  for (const f of FONT_WEIGHTS) {
    const subset = await subsetFont(readFileSync(join(FONT_SRC, f.src)), chars, { targetFormat: 'sfnt' });
    writeFileSync(join(FONT_OUT, f.out), subset);
    console.log(`font   ${f.out}: ${(subset.length / 1024).toFixed(0)} KB`);
  }
  copyFileSync(join(FONT_SRC, 'LICENSE_FONT'), join(FONT_OUT, 'OFL.txt'));
  writeFileSync(manifest, chars);
  console.log(`font   ${[...chars].length} characters`);
}

const vocab = buildVocab();
const kanji = buildKanji();
const grammar = buildGrammar();
const traps = buildTraps();

for (const w of warnings) console.warn(`warning: ${w}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\n${errors.length} error(s); nothing written.`);
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });
write('vocab', vocab);
write('kanji', kanji);
write('grammar', grammar);
write('traps', traps);

const count = (items: { level: Level }[], level: Level) => items.filter((i) => i.level === level).length;
console.log('level  vocab  kanji  grammar  traps');
for (const level of STUDY_LEVELS) {
  const cells = [vocab, kanji, grammar, traps].map((items) => String(count(items, level)).padStart(6));
  console.log(`${level.padEnd(5)}${cells.join(' ')}`);
}
console.log(`total${[vocab, kanji, grammar, traps].map((items) => String(items.length).padStart(6)).join(' ')}`);

buildFonts().catch((e) => {
  console.error('error: could not build the Android font subset', e);
  process.exit(1);
});

/**
 * Fills in missing vocabulary example sentences from Tatoeba (https://tatoeba.org, CC BY 2.0 FR).
 *
 *   npm run examples -- select   # pick one sentence per word → content/.cache/examples.tsv
 *   npm run examples -- apply    # copy the reviewed file into content/vocab/*.tsv
 *
 * `select` reads Tatoeba's weekly exports from content/.cache/tatoeba (download commands in
 * content/README.md). For each word without an example it prefers short sentences whose other words and
 * kanji are at or below the word's level, checks the word's reading against Tatoeba's furigana, and uses
 * a linked Mandarin translation, converted to Taiwan Traditional Chinese, when there is one. Rows
 * without a translation are left empty in the review file for a person to translate (source `zh:ai`
 * marks a translation not written on Tatoeba). Review the file, delete rows you don't want, then `apply`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import * as OpenCC from 'opencc-js';

import { hasKanji, isKana, isKatakana, toHiragana } from '../src/content/text';

const ROOT = join(__dirname, '..');
const CACHE = join(ROOT, 'content', '.cache', 'tatoeba');
const REVIEW = join(ROOT, 'content', '.cache', 'examples.tsv');
/** The next best sentences for each word, to swap in while reviewing. */
const ALTERNATIVES = join(ROOT, 'content', '.cache', 'alternatives.tsv');
const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'] as const;
/** Level rank: N5 = 1 … N1 = 5; 6 = not in the course. */
const UNKNOWN = 6;
const CONJUGATING = new Set(['v1', 'v5', 'vk', 'vz', 'adj-i']);
const NAMES = /トム|メアリー|メアリ|ジョン|ケン|ボブ|ジム|ナンシー|ベティー|ルーシー|マイク|ジャック|ビル|ナオミ|クミ/;

const openCC = OpenCC.Converter({ from: 'cn', to: 'twp' });
/** Mainland wording OpenCC keeps, in Taiwan usage. */
const TAIWAN: [RegExp, string][] = [
  [/一點兒/g, '一點'],
  [/有點兒/g, '有點'],
  [/哪兒/g, '哪裡'],
  [/這兒/g, '這裡'],
  [/那兒/g, '那裡'],
  [/玩兒/g, '玩'],
  [/一塊兒/g, '一起'],
  [/公交車/g, '公車'],
  [/出租車/g, '計程車'],
  [/自行車/g, '腳踏車'],
  [/早上好/g, '早安'],
  [/合同/g, '合約'],
];
const toTaiwan = (text: string) => TAIWAN.reduce((t, [from, to]) => t.replace(from, to), openCC(text));

// ---------------------------------------------------------------------------
// Course data

interface VocabRow {
  key: string;
  file: string;
  rank: number;
  word: string;
  reading: string;
  meaning: string;
  pos: string;
  hasExample: boolean;
}

function readLines(file: string): string[] {
  return readFileSync(file, 'utf8').replace(/^﻿/, '').split('\n');
}

function vocabRows(): VocabRow[] {
  return LEVELS.flatMap((level, i) => {
    const file = join(ROOT, 'content', 'vocab', `${level}.tsv`);
    return readLines(file).flatMap((raw) => {
      if (!raw.trim() || raw.trimStart().startsWith('#')) return [];
      const [word, reading, meaning, pos, ex] = raw.split('\t').map((c) => c.trim());
      return [{ key: `${word}:${reading}`, file, rank: i + 1, word, reading, meaning, pos, hasExample: !!ex }];
    });
  });
}

/** Lowest level at which each kanji is taught, as a kanji or inside a course word. */
function kanjiRanks(vocab: VocabRow[]): Map<string, number> {
  const ranks = new Map<string, number>();
  const see = (ch: string, rank: number) => ranks.set(ch, Math.min(rank, ranks.get(ch) ?? UNKNOWN));
  LEVELS.forEach((level, i) => {
    for (const raw of readLines(join(ROOT, 'content', 'kanji', `${level}.tsv`))) {
      if (raw.trim() && !raw.startsWith('#')) see(raw.split('\t')[0].trim(), i + 1);
    }
  });
  for (const v of vocab) for (const ch of v.word) if (hasKanji(ch)) see(ch, v.rank);
  return ranks;
}

// ---------------------------------------------------------------------------
// Tatoeba exports

function tsv(name: string): string[][] {
  const file = join(CACHE, name);
  if (!existsSync(file)) {
    console.error(`Missing ${file}. Download the Tatoeba exports first (see content/README.md).`);
    process.exit(1);
  }
  return readLines(file).flatMap((l) => (l ? [l.replace(/\r$/, '').split('\t')] : []));
}

const author = (s: string | undefined) => (!s || s === '\\N' ? '' : s);

/** A run of text with its reading: one kanji, a kanji group read as a whole (今日), or one kana. */
interface Unit {
  text: string;
  reading: string;
  /** Which `[…]` group of the furigana the unit came from; kanji in one group share one ruby. */
  group?: number;
}

/** Tatoeba furigana `[場所|ば|しょ]へ` → units, or undefined if the notation can't be used. */
function parseFurigana(src: string): Unit[] | undefined {
  const units: Unit[] = [];
  const plain = (text: string) => {
    for (const ch of text) units.push({ text: ch, reading: toHiragana(ch) });
    return !hasKanji(text); // every kanji needs a reading
  };
  let last = 0;
  let group = 0;
  for (const m of src.matchAll(/\[([^|\]]+)((?:\|[^|\]]*)+)\]/g)) {
    if (!plain(src.slice(last, m.index))) return undefined;
    const base = [...m[1]];
    const readings = m[2].split('|').slice(1).map(toHiragana);
    if (readings.some((r) => !r || ![...r].every((c) => isKana(c) || c === 'ー'))) return undefined;
    group++;
    if (readings.length === base.length) base.forEach((ch, i) => units.push({ text: ch, reading: readings[i], group }));
    else units.push({ text: m[1], reading: readings.join(''), group });
    last = (m.index ?? 0) + m[0].length;
  }
  return plain(src.slice(last)) ? units : undefined;
}

/** Reading of text[start, end), or undefined if a group reading (今日) is cut in half. */
function spanReading(units: Unit[], start: number, end: number): string | undefined {
  let pos = 0;
  let out = '';
  for (const u of units) {
    const len = u.text.length;
    const [a, b] = [pos, pos + len];
    pos = b;
    if (b <= start || a >= end) continue;
    if (len > 1 && (a < start || b > end)) return undefined;
    out += u.reading;
  }
  return out;
}

/** Units → this repo's ruby notation, one `{漢字|よみ}` per furigana group: `{場所|ばしょ}へ`. */
function toRuby(units: Unit[]): string {
  let out = '';
  let base = '';
  let reading = '';
  let group: number | undefined;
  const flush = () => {
    if (base) out += `{${base}|${reading}}`;
    base = reading = '';
  };
  for (const u of units) {
    if (u.group === undefined) {
      flush();
      out += u.text;
      continue;
    }
    if (u.group !== group) flush();
    group = u.group;
    base += u.text;
    reading += u.reading;
  }
  flush();
  return out;
}

interface Sentence {
  id: number;
  text: string;
  author: string;
  units?: Unit[];
  /** Index tokens (Tanaka corpus "B line"), when the sentence is indexed. */
  tokens?: Token[];
  zh: { id: number; text: string; author: string }[];
}

interface Token {
  head: string;
  reading?: string;
  surface: string;
  checked: boolean;
}

const TOKEN = /^([^(\[{~]+)(?:\(([^)]+)\))?(?:\[\d+\])?(?:\{([^}]+)\})?(~)?$/;

function loadTatoeba(): Map<number, Sentence> {
  const sentences = new Map<number, Sentence>();
  for (const [id, , text, user] of tsv('jpn_sentences_detailed.tsv')) {
    sentences.set(Number(id), { id: Number(id), text, author: author(user), zh: [] });
  }
  for (const [id, , script, , furigana] of tsv('jpn_transcriptions.tsv')) {
    const s = sentences.get(Number(id));
    if (!s || script !== 'Hrkt') continue;
    const units = parseFurigana(furigana);
    if (units && units.map((u) => u.text).join('') === s.text) s.units = units;
  }
  const cmn = new Map<number, { text: string; author: string }>();
  for (const [id, , text, user] of tsv('cmn_sentences_detailed.tsv')) cmn.set(Number(id), { text, author: author(user) });
  for (const [ja, zh] of tsv('jpn-cmn_links.tsv')) {
    const s = sentences.get(Number(ja));
    const t = cmn.get(Number(zh));
    if (s && t) s.zh.push({ id: Number(zh), ...t });
  }
  for (const [id, , line] of tsv('jpn_indices.csv')) {
    const s = sentences.get(Number(id));
    if (!s) continue;
    s.tokens = line.split(' ').flatMap((t) => {
      const m = TOKEN.exec(t);
      return m ? [{ head: m[1], reading: m[2], surface: m[3] ?? m[1], checked: !!m[4] }] : [];
    });
  }
  return sentences;
}

// ---------------------------------------------------------------------------
// Choosing a sentence

interface Candidate {
  row: VocabRow;
  s: Sentence;
  score: number;
}

/** Topics that don't belong in a general learning app (Tatoeba has some). */
const UNSUITABLE =
  /殺|死ね|自殺|心中|死体|オナニー|自慰|セックス|エッチ|ちんこ|ちんぽ|まんこ|おっぱい|レイプ|強姦|売春|ポルノ|麻薬|覚醒剤|ドラッグ|大麻|クソ|くそ|糞|野郎|てめえ|ぶっ殺|射精|勃起|処女|童貞|ヌード|裸|風俗|ホモ|レズ|オカマ|キチガイ|気違い|ブス|デブ|変態|妊娠|浮気|愛人|不倫|セフレ|エロ|酔っ払|ナチ|ヒトラー|テロ|爆弾|銃/;

/** Sentences a learner can use: one short sentence, Japanese script only, with usable furigana. */
function usable(s: Sentence): boolean {
  const len = [...s.text].length;
  if (!s.units || len < 6 || len > 30 || UNSUITABLE.test(s.text)) return false;
  if (/[A-Za-zＡ-Ｚａ-ｚ0-9０-９「」『』（）()〈〉【】“”"'…・／/:：;；]/.test(s.text)) return false;
  // One sentence: end punctuation only at the end.
  return !/[。！？!?](?=.*[^。！？!?」])/.test(s.text);
}

interface Occurrence {
  surface: string;
  at: number;
  indexed: boolean;
  checked: boolean;
}

/** Where the word occurs in the sentence, with its reading checked against the furigana. */
function occurrence(row: VocabRow, s: Sentence): Occurrence | undefined {
  const conjugating = CONJUGATING.has(row.pos);
  const reading = toHiragana(row.reading);
  const stem = conjugating ? reading.slice(0, -1) : reading;
  const written = conjugating ? row.word.slice(0, -1) : row.word;
  const katakana = [...row.word].every((c) => isKatakana(c) || c === 'ー');
  // A whole word, not part of a longer one (昼 in 昼寝, パン in フライパン), read as the course reads it.
  const joins = (ch: string | undefined) => !!ch && (hasKanji(ch) || (katakana && isKatakana(ch)));
  const find = (surface: string) => {
    for (let at = s.text.indexOf(surface); at >= 0; at = s.text.indexOf(surface, at + 1)) {
      const end = at + surface.length;
      if (joins(s.text[at - 1]) || joins(s.text[end])) continue;
      if (spanReading(s.units!, at, end)?.startsWith(stem)) return at;
    }
    return -1;
  };
  for (const t of s.tokens ?? []) {
    const tokenReading = t.reading === undefined ? undefined : toHiragana(t.reading);
    // Kana words are often indexed under a kanji spelling (すぐ under 直ぐ), so match what is written.
    const kanaMatch =
      !hasKanji(row.word) &&
      (tokenReading === reading || t.surface === row.word || (conjugating && written.length >= 2 && t.surface.startsWith(written)));
    if ((t.head !== row.word && !kanaMatch) || (tokenReading !== undefined && tokenReading !== reading)) continue;
    const at = find(t.surface);
    if (at >= 0) return { surface: t.surface, at, indexed: true, checked: t.checked };
  }
  // Not indexed for this word: plain text match for kanji and katakana words (hiragana alone is too ambiguous).
  if (!hasKanji(written) && !katakana) return undefined;
  const at = find(written);
  return at >= 0 ? { surface: written, at, indexed: false, checked: false } : undefined;
}

function score(row: VocabRow, s: Sentence, { surface, at, indexed, checked }: Occurrence, ranks: Map<string, number>, wordRanks: Map<string, number>): number {
  let points = 0;
  // Kanji outside the word: each level above the word's costs points, unknown kanji cost more.
  [...s.text].forEach((ch, i) => {
    if (i >= at && i < at + surface.length) return;
    if (!hasKanji(ch)) return;
    const r = ranks.get(ch) ?? UNKNOWN;
    if (r > row.rank) points -= r === UNKNOWN ? 4 : 2 * (r - row.rank);
  });
  // Other indexed words written with kanji: words above the level, or not in the course, cost points.
  for (const t of s.tokens ?? []) {
    if (t.head === row.word || !hasKanji(t.surface)) continue;
    const r = wordRanks.get(t.head) ?? UNKNOWN;
    if (r > row.rank) points -= r === UNKNOWN ? 1.5 : r - row.rank;
  }
  const len = [...s.text].length;
  points -= 0.15 * Math.abs(len - 14);
  if (s.zh.length > 0) points += 6;
  if (checked) points += 2;
  if (!indexed) points -= 1;
  if (hasKanji(row.word) && !hasKanji(surface)) points -= 3; // written in kana here
  if (NAMES.test(s.text)) points -= 1.5;
  if (/(彼女?|私)は\1の/.test(s.text)) points -= 2; // translationese: 彼は彼の部屋で…
  return points;
}

/** The translation to show: an original Traditional one if any, else the shortest, in Taiwan usage. */
function translation(s: Sentence): { id: number; text: string; author: string; original: string } | undefined {
  if (s.zh.length === 0) return undefined;
  const traditional = s.zh.filter((z) => openCC(z.text) === z.text);
  const pick = [...(traditional.length ? traditional : s.zh)].sort((a, b) => a.text.length - b.text.length)[0];
  return { ...pick, text: toTaiwan(pick.text), original: pick.text };
}

function select(): void {
  const vocab = vocabRows();
  const ranks = kanjiRanks(vocab);
  const wordRanks = new Map<string, number>();
  for (const v of vocab) wordRanks.set(v.word, Math.min(v.rank, wordRanks.get(v.word) ?? UNKNOWN));
  const sentences = [...loadTatoeba().values()].filter(usable);

  // Sentences by kanji and by indexed word (head, reading or written form), so matching doesn't scan
  // every sentence for every word.
  const byChar = new Map<string, Sentence[]>();
  const byWord = new Map<string, Sentence[]>();
  const add = (map: Map<string, Sentence[]>, key: string, s: Sentence) => {
    const list = map.get(key);
    if (list) list.push(s);
    else map.set(key, [s]);
  };
  for (const s of sentences) {
    for (const ch of new Set(s.text)) if (hasKanji(ch)) add(byChar, ch, s);
    for (const t of s.tokens ?? []) {
      for (const key of new Set([t.head, t.surface, t.reading ? toHiragana(t.reading) : ''])) if (key) add(byWord, key, s);
    }
  }

  const todo = vocab.filter((v) => !v.hasExample);
  const options = new Map<string, Candidate[]>();
  for (const row of todo) {
    const firstKanji = [...row.word].find((ch) => hasKanji(ch));
    const katakana = [...row.word].every((c) => isKatakana(c) || c === 'ー');
    const pool = new Set([
      ...(byWord.get(row.word) ?? []),
      ...(firstKanji ? byChar.get(firstKanji) ?? [] : []),
      // Loanwords are often not indexed at all.
      ...(katakana ? sentences.filter((s) => s.text.includes(row.word)) : []),
    ]);
    const found: Candidate[] = [];
    for (const s of pool) {
      const hit = occurrence(row, s);
      if (hit) found.push({ row, s, score: score(row, s, hit, ranks, wordRanks) });
    }
    options.set(row.key, found.sort((a, b) => b.score - a.score));
  }

  // Words with the fewest options choose first; each sentence is used once.
  const used = new Set<number>();
  const chosen = new Map<string, Candidate>();
  for (const row of [...todo].sort((a, b) => options.get(a.key)!.length - options.get(b.key)!.length)) {
    const best = options.get(row.key)!.find((c) => !used.has(c.s.id) && c.score > -12);
    if (!best) continue;
    used.add(best.s.id);
    chosen.set(row.key, best);
  }

  const header = ['# key', 'level', 'meaning', 'ja', 'zh', 'source', 'zh_original', 'score'].join('\t');
  const line = (row: VocabRow, c: Candidate) => {
    const zh = translation(c.s);
    const source = `tatoeba:${c.s.id}:${c.s.author}` + (zh ? ` zh:${zh.id}:${zh.author}` : ' zh:ai');
    return [row.key, `N${6 - row.rank}`, row.meaning, toRuby(c.s.units!), zh?.text ?? '', source, zh?.original ?? '', c.score.toFixed(1)].join('\t');
  };
  const lines = todo.flatMap((row) => {
    const c = chosen.get(row.key);
    return c ? [line(row, c)] : [];
  });
  writeFileSync(REVIEW, [header, ...lines].join('\n') + '\n');
  const alternatives = todo.flatMap((row) =>
    options
      .get(row.key)!
      .filter((c) => c !== chosen.get(row.key) && c.score > -12)
      .slice(0, 5)
      .map((c) => line(row, c)),
  );
  writeFileSync(ALTERNATIVES, [header, ...alternatives].join('\n') + '\n');
  const withZh = lines.filter((l) => l.split('\t')[4]).length;
  console.log(`${todo.length} words without an example; ${lines.length} matched (${withZh} with a Tatoeba translation).`);
  console.log(`Review file: ${REVIEW}`);
}

// ---------------------------------------------------------------------------
// Writing the reviewed examples into the course

function apply(): void {
  const picked = new Map<string, { ja: string; zh: string; source: string }>();
  for (const raw of readLines(REVIEW)) {
    if (!raw.trim() || raw.startsWith('#')) continue;
    const [key, , , ja, zh, source] = raw.split('\t');
    if (!zh?.trim()) {
      console.error(`${key}: no translation; translate it or delete the row.`);
      process.exit(1);
    }
    picked.set(key, { ja, zh: zh.trim(), source });
  }
  let written = 0;
  for (const level of LEVELS) {
    const file = join(ROOT, 'content', 'vocab', `${level}.tsv`);
    const out = readLines(file).map((raw) => {
      if (!raw.trim() || raw.trimStart().startsWith('#')) return raw;
      const cols = raw.split('\t');
      const ex = picked.get(`${cols[0].trim()}:${cols[1].trim()}`);
      if (!ex || cols[4]?.trim()) return raw;
      while (cols.length < 8) cols.push('');
      [cols[4], cols[5], cols[7]] = [ex.ja, ex.zh, ex.source];
      while (!cols[cols.length - 1]) cols.pop();
      written++;
      return cols.join('\t');
    });
    writeFileSync(file, out.join('\n'));
  }
  console.log(`Wrote ${written} examples. Run npm run build:content next.`);
}

const command = process.argv[2];
if (command === 'select') select();
else if (command === 'apply') apply();
else {
  console.error('Usage: npm run examples -- select | apply');
  process.exit(1);
}

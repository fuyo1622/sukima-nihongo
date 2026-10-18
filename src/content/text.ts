/** Helpers for Japanese text: ruby notation and kana classification. */

export interface RubySegment {
  text: string;
  ruby?: string;
}

const RUBY_RE = /\{([^{}|]+)\|([^{}|]+)\}/g;

/** `{私|わたし}は{学生|がくせい}です` → segments with optional readings. */
export function parseRuby(src: string): RubySegment[] {
  const out: RubySegment[] = [];
  let last = 0;
  for (const m of src.matchAll(RUBY_RE)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ text: src.slice(last, index) });
    out.push({ text: m[1], ruby: m[2] });
    last = index + m[0].length;
  }
  if (last < src.length) out.push({ text: src.slice(last) });
  return out;
}

/** Plain text without readings: `{私|わたし}は` → `私は`. */
export function rubyBase(src: string): string {
  return src.replace(RUBY_RE, '$1');
}

/** Text with every annotated part replaced by its reading: `{私|わたし}は` → `わたしは`. */
export function rubyReading(src: string): string {
  return src.replace(RUBY_RE, '$2');
}

export function isHiragana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return c >= 0x3041 && c <= 0x309f;
}

export function isKatakana(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x30a0 && c <= 0x30ff) || (c >= 0x31f0 && c <= 0x31ff);
}

export function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch);
}

export function hasKanji(s: string): boolean {
  return /[㐀-䶿一-鿿豈-﫿々〆ヶ]/.test(s);
}

export function isKanaOnly(s: string): boolean {
  return [...s].every((ch) => isKana(ch) || ch === 'ー' || ch === '・');
}

/** Katakana → hiragana (leaves ー and other characters untouched). */
export function toHiragana(s: string): string {
  return s.replace(/[ァ-ヶ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

/** Hiragana → katakana. */
export function toKatakana(s: string): string {
  return s.replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
}

/** Kun'yomi as stored (`まな.ぶ`) → display form (`まなぶ`). */
export function kunPlain(kun: string): string {
  return kun.replace(/[.\-]/g, '');
}

/**
 * Aligns a word with its reading and returns ruby notation, e.g.
 * `食べる` + `たべる` → `{食|た}べる`, `取り消す` + `とりけす` → `{取|と}り{消|け}す`.
 * Falls back to annotating the whole word when the kana parts cannot be matched.
 */
export function alignRuby(word: string, reading: string): string {
  if (!hasKanji(word)) return word;
  const runs: { kana: boolean; text: string }[] = [];
  for (const ch of word) {
    const kana = isKana(ch) || ch === 'ー';
    const lastRun = runs[runs.length - 1];
    if (lastRun && lastRun.kana === kana) lastRun.text += ch;
    else runs.push({ kana, text: ch });
  }
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = runs.map((r) => (r.kana ? escape(toHiragana(r.text)) : '(.+?)')).join('');
  const match = new RegExp(`^${pattern}$`).exec(toHiragana(reading));
  if (!match) return `{${word}|${reading}}`;

  // Map the matched groups back onto the original reading (which may contain katakana).
  let out = '';
  let pos = 0;
  let group = 1;
  const hira = toHiragana(reading);
  for (const r of runs) {
    if (r.kana) {
      out += r.text;
      pos += r.text.length;
    } else {
      const g = match[group++];
      const start = hira.indexOf(g, pos);
      out += `{${r.text}|${reading.slice(start, start + g.length)}}`;
      pos = start + g.length;
    }
  }
  return out;
}

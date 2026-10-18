# Content sources

Everything the app teaches (except kana, which is generated in `src/content/kana.ts`) lives here as
plain text. Run `npm run build:content` after editing: it validates everything, aligns furigana, assigns
ids and difficulties, and writes `src/content/data/*.json`. If there is any error it prints the file and
line and writes nothing.

**File order is curriculum order.** Within a level, earlier lines are taught first (lower difficulty).

## Japanese text with readings

Write readings as `{漢字|かんじ}`: `{私|わたし}は{学生|がくせい}です。`
For vocabulary the word's own furigana is aligned automatically (`食べる` + `たべる` → `{食|た}べる`),
so you only write readings in example sentences and grammar.

## vocab/n5.tsv … n1.tsv

Tab-separated; `#` starts a comment line.

| Column | Required | Example |
|---|---|---|
| word | ✓ | `食べる` |
| reading (kana) | ✓ | `たべる` |
| meaning (Traditional Chinese, senses separated by `；`) | ✓ | `吃` |
| part of speech: `n pron num ctr v1 v5 vs vk vz adj-i adj-na adn adv conj int exp prt pref suf` | ✓ | `v1` |
| example (Japanese with readings) | | `{毎朝|まいあさ}パンを{食|た}べます。` |
| example translation | if example given | `每天早上吃麵包。` |
| note | | `長得像一段動詞，其實是五段動詞` |
| example source, for sentences from Tatoeba | | `tatoeba:12345:author zh:67890:author`, or `zh:ai` when the Chinese is not from Tatoeba |

## Example sentences from Tatoeba

Most vocabulary examples come from [Tatoeba](https://tatoeba.org) (CC BY 2.0 FR; the Tanaka Corpus part is
public domain). The license asks for each sentence's author, so the source column keeps the sentence id and
author and the app shows them under the example. `npm run examples` fills in words that have no example:

1. Download the weekly exports into `content/.cache/tatoeba/` (git ignores `content/.cache/`) and unpack them:
   ```bash
   B=https://downloads.tatoeba.org/exports
   for f in per_language/jpn/jpn_sentences_detailed.tsv.bz2 per_language/jpn/jpn_transcriptions.tsv.bz2 per_language/jpn/jpn-cmn_links.tsv.bz2 per_language/cmn/cmn_sentences_detailed.tsv.bz2; do curl -sSLO "$B/$f"; done
   curl -sSLO "$B/jpn_indices.tar.bz2"
   bzip2 -d *.tsv.bz2 && tar -xjf jpn_indices.tar.bz2
   ```
2. `npm run examples -- select` picks one sentence per word into `content/.cache/examples.tsv`: short, the
   word's reading checked against Tatoeba's furigana, other words and kanji at or below the word's level,
   no unsuitable topics (blocklist in the script), and a linked Mandarin translation converted to Taiwan
   Traditional Chinese (OpenCC) when there is one. `alternatives.tsv` lists the next five for each word.
3. Review every row. Tatoeba's furigana and translations have mistakes, and some sentences use a different
   word with the same spelling. Fix or swap rows and translate the empty ones (their source ends in `zh:ai`).
4. `npm run examples -- apply` writes the rows into `vocab/*.tsv`; then run `npm run build:content`.

## kanji/n5.tsv … n1.tsv

| Column | Example |
|---|---|
| kanji | `学` |
| Traditional Chinese form, or `-` if identical | `學` |
| on'yomi in katakana, comma-separated, or `-` | `ガク` |
| kun'yomi in hiragana, okurigana after `.`, or `-` | `まな.ぶ` |
| meaning | `學習` |
| example words `語:讀音:意思` separated by `/` | `学生:がくせい:學生/大学:だいがく:大學` |
| note (optional) | `日本自創的漢字（國字）` |

## grammar/n5.txt … n1.txt

```
@ n4-te-oku
pattern: 〜ておく
meaning: 事先做好～
form: 動詞て形 + おく
explain: 為了之後的某個目的，事先做好準備。
ex: {旅行|りょこう}の{前|まえ}にホテルを{予約|よやく}しておきます。 = 旅行前先預約好飯店。
q: {会議|かいぎ}の{前|まえ}に{資料|しりょう}をコピーしてお＿＿ます。 = き | か | く | こ = 會議前先把資料影印好。
```

* `q:` is `sentence with exactly one ＿＿ = answer | wrong | wrong | wrong = translation`.
* **Exactly one option may be correct.** Distractors must be ungrammatical in the blank, or clearly wrong
  given the translation. Watch out for forms that are also grammatical (〜たが最後 / 〜たら最後,
  〜ばかりだ / 〜一方だ, 「着いたばかり」 / 「着いたところ」): these were the most common problems when
  writing v1.
* Ids (`@ n4-te-oku`) must never change once released; progress is keyed on them.

## traps.tsv (漢字陷阱)

`word · reading · level (N5–N1) · real Japanese meaning · what a Chinese reader would guess · example · translation`

## Android font subset

Android phones set to Chinese would draw Japanese kanji in Chinese glyph forms, so the app bundles Noto Sans
JP, cut down to the characters the content actually uses. `npm run build:content` collects every Japanese
character from these files (plus kana, full-width punctuation and the fixed UI strings in
`UI_JAPANESE` in `scripts/build-content.ts`) and rewrites `assets/fonts/NotoSansJP-*.ttf` when the set
changes. Commit the regenerated fonts together with the content. Characters outside the subset still
display, just in the phone's fallback font: if you add Japanese text to the UI code, add it to
`UI_JAPANESE`.

## Ids and learner progress

Ids are built from the content (`v:<word>:<reading>`, `k:<kanji>`, `g:<id>`, `t:<word>`), so reordering
lines or moving an item to another level keeps everyone's progress. Changing a word's spelling or reading
creates a new item.

## Scaling to the full JLPT lists

1. Import an open word list per level (e.g. Jonathan Waller's JLPT lists, CC BY) and KANJIDIC2 for kanji
   readings (CC BY-SA 4.0). Keep attribution, and keep share-alike data separate from original content.
2. Draft the Traditional Chinese meanings, examples and notes with an LLM, in batches, into new TSV rows.
3. **Human review** by a native speaker or teacher, especially grammar quizzes and example sentences.
4. `npm run build:content` then `npm test`. The build and tests are the quality gate.

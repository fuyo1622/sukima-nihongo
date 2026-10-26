# スキマ日語 (Sukima Nihongo): Design

> 零碎時間，一點一點學日語: learn Japanese in the gaps of your day.
>
> A micro-learning Japanese app for **Traditional Chinese speakers**. Learners study in 1–5 minute
> blocks on the train, over lunch or in a queue, with or without sound, and go from kana to
> **JLPT N1** at a difficulty that adapts to them.

| | |
|---|---|
| **Users** | Traditional Chinese speakers (Taiwan, Hong Kong, overseas), from complete beginners to advanced |
| **Context** | Spare moments of 1–5 minutes: commuting, eating, waiting. Often one-handed and often interrupted |
| **Promise** | One tap from opening the app to the first question, and no progress lost when interrupted |
| **Scope** | Kana → N5 → N4 → N3 → N2 → N1: vocabulary, kanji, grammar, listening, plus Chinese-speaker-specific modules |
| **Platform** | iOS and Android from one Expo / React Native codebase (a web build is used for development and, deployed on Vercel as an offline Home Screen app, for testing on phones) |

Contents: [1 Users](#1-users-and-contexts) · [2 Principles](#2-design-principles) ·
[3 Learning block](#3-the-learning-block-學習小節) · [4 Exercises](#4-exercise-types) ·
[5 Curriculum](#5-curriculum-and-content) · [6 Adaptivity](#6-adaptive-difficulty) ·
[7 UX](#7-user-experience) · [8 Architecture](#8-technical-architecture) ·
[9 Privacy](#9-privacy-and-data) · [10 Metrics](#10-success-metrics) · [11 Roadmap](#11-roadmap) ·
[12 Risks](#12-risks-and-open-questions)

---

## 1. Users and contexts

### Personas

| | 小雯 · 24 · Taipei | 阿傑 · 31 · Hong Kong | 美玲 · 45 · Kaohsiung |
|---|---|---|---|
| Level | Complete beginner | ~N3, wants N2 for a job in Japan | Learned kana years ago, anime/drama fan |
| When | 40-min MRT commute, standing | Lunch break, earbuds in | Evenings, irregular |
| Needs | Kana without boredom, silent mode on the train | Efficient review, listening, grammar | Forgiving resume, no guilt when she skips days |

### Context → design response

| Context | Constraint | Design response |
|---|---|---|
| Standing on the MRT/bus | One hand; interrupted at every stop (every 2–3 min); may have no earphones | 1–5 min blocks; auto-save after every answer; answers in the thumb zone; **silent mode** |
| Earphones in | Can listen, but the phone's ring/silent switch is often on | **Sound mode** plays even in silent mode (explicit in-app choice) and mixes with the user's music |
| Eating | One hand, divided attention | Taps only (no typing), large targets, auto-advance on correct answers |
| Underground, no signal | Offline | All content bundled; on-device text-to-speech |
| Night commute | Dark carriage | Full dark mode |
| Short, unpredictable gaps | Unknown time budget | Choose 1 / 3 / 5 minutes on the home screen, one tap to start or resume |

## 2. Design principles

1. **One tap to learning.** Opening the app shows one primary action: start, or resume where you left off.
2. **Every answer is saved.** Scheduling and statistics update at answer time, not at the end of a block,
   so closing the app mid-block loses nothing.
3. **Sound is optional, never required.** Every listening exercise has a silent twin with the same
   answer options; switching modes mid-question just changes how the question is shown.
4. **Build on what Chinese speakers already know.** Skip kanji meanings they can read already; spend
   the time on readings, kana, grammar, shape differences (新字體/繁體) and false friends (漢字陷阱).
5. **Right difficulty, automatically, with the learner in charge.** The target is roughly 80% success;
   "太簡單／太難" feedback and manual level choice always win.
6. **Taps only in v1.** No keyboard: typing Japanese on a train with one thumb is a poor experience.
7. **Offline first, private by default.** No account, no network required, data stays on the phone.

## 3. The learning block (學習小節)

### 3.1 Anatomy

A block is a short sequence of **steps**. Each step is one screen: either a teaching card for a new
item (教學卡) or one multiple-choice question.

| Length | Steps | Typical mix (smart mode) |
|---|---|---|
| 1 min | 5 | 1 new item (intro + check) + 3 reviews |
| 3 min | 10 | 3 new items + 4 reviews |
| 5 min | 16 | 4 new items + 8 reviews |

Composition rules (`src/engine/blockBuilder.ts`):

1. **Due reviews first**, most overdue first (FSRS schedule).
2. **New items** fill the rest, easiest first within the learner's window (see §6). Each new item is an
   intro card followed, one or two steps later, by a check question, so recall is tested after a gap.
3. If few reviews are due, the free slots go to new material; if nothing new is left, the weakest learned
   items are practised early.
4. A **review backlog** (more than 3× the block size) caps new items at one per block, so the learner
   consolidates before adding more.
5. **Missed questions come back** at the end of the block, reshuffled (at most 3 per block). Re-asks are
   practice only and do not change the schedule a second time.

Example 3-minute block for an N5 learner:

```
 1 intro  学生 (新單字)         6 review  来週
 2 review 毎日                  7 check   食べる   ← 2 steps after its intro
 3 check  学生  ← spaced        8 review  〜てください
 4 review 猫                    9 intro   〜てもいい
 5 intro  食べる               10 check   〜てもいい
                               (11 retry  毎日      ← missed in step 2)
```

**"我已經會了" (test-out).** On an intro card the learner can claim they already know the item. The
item's check question moves to the very next step; if it is answered correctly the item is scheduled as
*Easy* (far in the future) and counts extra toward the ability estimate. This matters for Chinese speakers:
many kanji words (学生, 電話, 野菜…) are familiar in meaning, so they can skip ahead quickly.

### 3.2 Block types

| Block | Where | Content |
|---|---|---|
| 智慧學習 (smart) | Today → 開始學習 | Due reviews + new items chosen by the adaptive engine |
| 複習 (review) | Today / 複習 tab | Due items; if none are due, the weakest items early (提前練習弱項) |
| 程度 (level) | 課程 → 學 N3 | New items and reviews from one level |
| 漢字陷阱 (traps) | Today / 課程 | The false-friend module only |
| 五十音 (kana stage) | automatic | Complete beginners get hiragana first, then katakana mixed with easy words |

### 3.3 Interruption and resume

* The whole block (steps, shuffled options, answers, position) is written to storage after **every**
  answer and every step change (`src/state/session.ts`).
* Scheduling (FSRS) and ability updates are applied **when the answer is given**.
* Home shows 「繼續上次的小節 · 還剩 N 題」; one tap reopens the **exact** question with the same
  options, including its feedback state if it had already been answered.
* The question timer restarts when the app returns from the background, and answers slower than 45 s
  are treated as interruptions rather than hesitation (they are not graded as "hard").
* Unfinished blocks older than three days are dropped silently; their answers already count.

### 3.4 Sound and silent modes

| | 有聲模式 (sound) | 靜音模式 (silent) |
|---|---|---|
| Pronunciation | Auto-plays on intro cards and after each answer; replay buttons everywhere | Never plays; readings shown in kana/furigana |
| Listening questions | 聽音選假名, 聽音選意思 | Never generated |
| Already-built listening question | shown as audio | shown as its **silent twin** with the same options |

* The toggle is one tap away on every learning screen (header chip 🔊有聲 / 🔇靜音), on Today, and in 我的.
* Speech uses the phone's own Japanese voice (AVSpeechSynthesizer on iOS, the system TTS engine on
  Android), so it works offline. Enhanced and on-device voices are preferred over network ones.
* **No Japanese voice** (possible on Android, where voice data is downloaded per language): the app never
  falls back to the default voice, which on a Taiwanese phone would read 日本 in Mandarin. Instead the
  header chip shows ⚠ 無語音, 今天 and 我的 explain how to install a voice (Android: a button opens the
  text-to-speech settings), and sound mode behaves like silent mode for questions until a voice works.
  The check runs at launch and whenever the app returns to the foreground.
* In sound mode the audio session is set to play even with the ring/silent switch on (the in-app choice
  wins) and to **mix** with music or podcasts instead of stopping them.
* Words are spoken from their **kana reading** so the speech engine cannot misread kanji (今日 → きょう);
  sentences keep their kanji so particles like は/へ are pronounced naturally.

## 4. Exercise types

All exercises are 4-option multiple choice plus 「不知道，看答案」 (counts as wrong, discourages guessing).

| Kind | Prompt → options | Silent twin |
|---|---|---|
| 看假名選讀音 `kana_read` | あ → a / o / u / e | — |
| 選出對應的假名 `kana_pick` | ka → か / き / た / な | — |
| 聽音選假名 `kana_listen` 🔊 | (audio) → あ / め / ぬ / お | `kana_pick` |
| 看字選意思 `vocab_meaning` | 勉強 → 讀書；學習 / 練習 / … | — |
| 看字選讀音 `vocab_reading` | 学生 → がくせい / がくせ / かくせい / … | — |
| 中翻日 `vocab_word` | 讀書；學習 → 勉強 / 練習 / … | — |
| 聽音選意思 `vocab_listen` 🔊 | (audio がくせい) → 學生 / … | `vocab_meaning` |
| 漢字意思 `kanji_meaning` | 気 → 氣；精神 / … | — |
| 漢字讀音 `kanji_reading` | 学 (音讀) → ガク / カク / … | — |
| 新字體對照 `kanji_form` | 気 → 氣 / 汽 / 器 / 棄 | — |
| 文法填空 `grammar_cloze` | 私＿＿学生です → は / を / に / で | — |
| 漢字陷阱 `trap_meaning` | 手紙 → 信 / 衛生紙 / … | — |

**Which exercise when.** The check right after an intro tests the hard part: for kanji words that is
the **reading** (Chinese speakers can usually guess the meaning), for kana-only words the meaning. Reviews
rotate through angles (reading → production → meaning → listening) using the review count. Meaning
and production are skipped when the Chinese gloss is the word itself (学校 → 「學校」, 火 → 「火」, about a
quarter of the words and most kanji), because they would give the answer away (`glossNamesItself`).

**Distractors** (`src/engine/exercises.ts`):

* Meanings come from the same part of speech and nearby levels, and are rejected if they share a sense
  with the answer (「學生」 vs 「學生；學員」).
* Kana distractors come from **look-alike groups** (シ/ツ/ミ, ソ/ン/リ, ぬ/め/あ…), never from kana that
  sound the same (じ/ぢ).
* Reading distractors include **near misses** aimed at typical Chinese-speaker errors: long vowels
  (おばさん／おばあさん), the small っ (きて／きって), voicing (か／が) and small ゃゅょ (きょう／きよう).
* Grammar options are hand-written and reviewed so that exactly one option is correct; the Chinese
  translation under each sentence resolves pragmatic choices such as ね/よ.

## 5. Curriculum and content

### 5.1 Scope

| Stage | Vocabulary | Kanji | Grammar | Notes |
|---|---|---|---|---|
| 入門 (kana) | — | — | — | 208 kana: hiragana + katakana, 清音・濁音・半濁音・拗音, each with 字源 |
| N5 | 605 | 101 | 55 | full N5 kanji list |
| N4 | 557 | 168 | 50 | full N4 kanji list |
| N3 | 522 | 211 | 46 | |
| N2 | 506 | 176 | 41 | |
| N1 | 396 | 140 | 37 | |
| 漢字陷阱 | 99 false friends across N5–N1 | | | |
| **Total** | **2,586** | **796** | **229** | **3,918 items including kana and traps** |

For comparison, commonly used (unofficial) lists put the full scope near N5 ≈ 700 / 100 / 80,
N4 ≈ 650 / 170 / 90, N3 ≈ 1,800 / 370 / 100, N2 ≈ 1,800 / 370 / 200 and N1 ≈ 3,500 / 1,200 / 200
(vocabulary / kanji / grammar). The JLPT has not published official lists since 2010. v1 covers the
beginner levels almost completely and ships a substantial core for N3–N1; §5.4 describes how to scale up.

Every level is covered, and every item carries a difficulty on one 0–1000 scale, so the adaptive engine
works the same way from あ to N1.

### 5.2 Content types

| Type | Fields (see `src/content/types.ts`) |
|---|---|
| Kana | kana, romaji, script, group, 字源 (origin kanji), notes (は/へ as particles, じ/ぢ…) |
| Vocabulary | word, reading, auto-aligned furigana, zh-TW meaning, part of speech, example sentence (with its Tatoeba source and author when it comes from there), note |
| Kanji | kanji, **Traditional Chinese form when different**, on'yomi, kun'yomi, meaning, example words, note |
| Grammar | pattern, meaning, 接續 (formation), explanation, examples, fill-in-the-blank quizzes |
| 漢字陷阱 | word, reading, the real Japanese meaning, the misleading Chinese reading, example |

### 5.3 Features for Chinese speakers

* **新字體 ↔ 繁體.** Every kanji whose Japanese form differs from Traditional Chinese (学/學, 気/氣,
  駅/驛, 広/廣, 歩/步…) shows both side by side; there is a dedicated exercise for the mapping. Kanji that
  exist only in Japanese (働, 込, 峠) are marked as 國字, and traps such as 欠 (= 缺, not 欠錢) are noted.
* **漢字陷阱 (false friends).** 99 words that look Chinese but mean something else: 手紙 (信),
  勉強 (讀書), 大丈夫 (沒問題), 床 (地板), 娘 (女兒), 汽車 (火車), 深刻 (嚴重), 心中 (殉情)… Each has a
  daily tip on the home screen and its own practice module.
* **字源 for kana.** あ ← 安, イ ← 伊, with traditional forms where relevant (よ ← 与（與）).
* **Readings first.** Checks on kanji words test the reading, not the obvious meaning.
* **Taiwan-standard vocabulary** in translations (計程車, 捷運, 腳踏車, 冷氣, 原子筆, 便當…).
* **Correct glyphs.** Japanese text is rendered with a Japanese font and Chinese with a Chinese one.
  Unified code points such as 直, 角, 骨 have different glyph shapes in Japanese and Chinese, and learners
  should see the Japanese forms. iOS has Hiragino Sans and PingFang TC. Android picks CJK glyphs by the
  phone's language, so a phone set to 中文（台灣） would draw Japanese in Chinese forms: the app bundles
  **Noto Sans JP** (SIL OFL), subset to the ~1,900 characters the content uses (Regular and Bold, about
  0.7 MB each). `npm run build:content` regenerates the subset when new characters appear.

### 5.4 Content pipeline

```
content/*.tsv, content/grammar/*.txt     human-editable, spreadsheet-friendly
          │   npm run build:content      validate · align furigana · assign ids and difficulty
          ▼
src/content/data/*.json                  bundled with the app (≈1 MB)
          │   require() at startup
          ▼
src/content/index.ts                     registry: by id, by type (sorted by difficulty), counts
```

* **Stable ids** (`v:学生:がくせい`, `k:学`, `g:n5-te-mo-ii`, `t:手紙`, `ka:あ`) so learner progress
  survives content edits and reordering.
* **Difficulty** = level band + position in the source file, which is the curriculum order.
* **Validation** fails the build on missing fields, non-kana readings, broken furigana, quizzes without
  exactly one blank, duplicate options, or an answer repeated among the distractors.
* **Scaling to full N1**: import an open JLPT word list (e.g. Jonathan Waller's lists, CC BY) and
  KANJIDIC2 (CC BY-SA 4.0) → draft zh-TW glosses, examples and notes with an LLM → **native-speaker or
  teacher review** → append to the TSV sources. The build script is the quality gate. See
  `content/README.md`.
* **Example sentences**: every word has one. About 2,240 come from Tatoeba (CC BY 2.0 FR), picked by
  `npm run examples` for length, level and a reading check, then reviewed by hand (furigana, wrong-word
  matches, unsuitable topics, Taiwan wording). The Chinese is Tatoeba's own translation for about 1,300 of
  them and a reviewed translation for the rest. The other ~340 were written for the course. Each
  Tatoeba sentence shows its author under the example (the license requires credit) and links to it.

## 6. Adaptive difficulty

### 6.1 One scale for items and learners

| Band | kana | N5 | N4 | N3 | N2 | N1 |
|---|---|---|---|---|---|---|
| Difficulty `d` | 0–150 | 150–350 | 350–500 | 500–650 | 650–800 | 800–1000 |

The learner has an ability **θ** per skill (kana, vocabulary, kanji, grammar) on the same scale
(`src/engine/adaptive.ts`).

### 6.2 Updating ability (Elo-style)

After every graded answer:

```
expected = 1 / (1 + e^-((θ − d + 50) / 60))     ≈ 73% for an item right at θ (it was just taught)
θ       += K · (score − expected)                 score: 1 correct · 0.7 slow · 0 wrong
K        = weight · max(10, 48 / √(1 + n/8))      shrinks as evidence accumulates
weight   = 1 first check · 1.5 tested out · 0.5 review
```

### 6.3 Choosing new items

New items are taken **easiest first**, but never below **θ − 120**. Learners who keep scoring well push θ
up and skip material that is too easy for them. Learners who struggle keep θ near their frontier and
progress one item at a time, and nothing is skipped.

### 6.4 Signals

| Signal | Effect |
|---|---|
| Correct / wrong on a check or review | Elo update (above) and FSRS grade |
| Answer speed | Slow but correct → FSRS *Hard*, score 0.7 (interruptions over 45 s excluded) |
| 「我已經會了」 + correct check | FSRS *Easy*, 1.5× ability weight: fast skip-ahead |
| End-of-block 「太簡單／剛剛好／太難」 | θ ± 40 for the block's skills; new-item **pace** ×1.15 / ×0.8 (0.5–1.5) |
| Review backlog > 3 blocks | At most one new item per block |

### 6.5 Manual mode, placement and level display

* **自己選程度**: new items come only from the chosen level (easiest first), moving up only when it is
  exhausted. θ keeps updating for display.
* **Onboarding** asks for a starting point (完全沒學過 / 會五十音 / N4 … N1 / 不確定). A stated level sets
  θ one window above the level's start, so its easiest items come first.
* **Placement test (程度測驗)**: 14 questions, a staircase starting at θ = 300 with step sizes
  150 → 35. It drops to kana questions below θ = 150, needs no sound, and includes a 「不知道」 option.
* The **current level** (e.g. 「程度 N4（自動）」) is the average θ of vocabulary, kanji and grammar, or
  入門 while the learner is still on kana.

### 6.6 Spaced repetition

[FSRS](https://github.com/open-spaced-repetition/ts-fsrs) (ts-fsrs 5, target retention 0.9, fuzz on,
max interval 10 years), one card per item. Multiple-choice grading: wrong → *Again*, correct & slow →
*Hard*, correct → *Good*, tested-out → *Easy*. An item counts as **熟練 (mastered)** once it is in review
with stability ≥ 21 days. 「容易忘記的」 lists items that lapsed, or were missed and are still being
relearned.

## 7. User experience

### 7.1 Navigation

```
Tabs ─┬─ 今天 Today    start / resume · 1-3-5 min · streak · goal · quick actions · daily 漢字陷阱
      ├─ 課程 Course   auto/manual difficulty · levels 入門…N1 with progress · special modules
      ├─ 複習 Review   due count & forecast · 開始複習 / 提前練習弱項 · 容易忘記的 list
      └─ 我的 Me       stats · block length · daily goal · content focus · sound · display · data
Full-screen ─ 學習小節 (session) · 程度測驗 (placement) · 新手引導 (onboarding)
Modal ─────── 五十音表 (kana chart)
```

Android back button / gesture: in a block it acts like ✕ (progress is already saved); in the placement
test it leaves the test; in onboarding it goes to the previous page; elsewhere it behaves as usual.

### 7.2 Session screen

```
┌──────────────────────────────────┐
│ ✕  ▓▓▓▓▓▓░░░░░░░░░░░   🔇 靜音 │  ← close = saved; sound toggle always here
│                                  │
│        這個單字怎麼唸？            │
│              がくせい             │  ← furigana revealed after answering
│              学 生                │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ がくせい                   ✓ │ │  ← options in the thumb zone
│ ├──────────────────────────────┤ │     ≥ 56 pt tall, 2×2 grid when short
│ │ がくせ                       │ │
│ ├──────────────────────────────┤ │
│ │ かくせい                     │ │
│ ├──────────────────────────────┤ │
│ │ がっくせい                   │ │
│ └──────────────────────────────┘ │
│ ┌ ✓ 答對了！ 学生 がくせい 學生 ┐ │  ← answer card
├──────────────────────────────────┤
│           繼  續  →              │  ← pinned footer; auto-advances when correct
└──────────────────────────────────┘
```

### 7.3 One-handed, glanceable rules

* Primary actions live in a pinned footer; answer options sit in the lower half of the screen.
* Minimum target height 56 pt (options 56–72 pt); generous spacing between options.
* One question per screen and no scrolling in the common case.
* Feedback you can feel: success/error haptics, plus colour **and** an icon (never colour alone).
* Correct answers auto-advance (1.5 s with sound, 0.9 s silent); wrong answers wait for 繼續.

### 7.4 Visual design

* Palette: 和紙 washi background `#F6F3EC`, 藍 indigo primary `#2F4E8C`, 朱 vermilion accent `#C8492A`,
  with full dark-mode counterparts (`src/ui/theme.ts`). Text colours meet WCAG AA contrast on their backgrounds.
* Type: Japanese in Hiragino Sans (iOS) or bundled Noto Sans JP (Android); Chinese in PingFang TC (iOS)
  or the system font (Android, which follows the phone's 中文 setting); system font for Latin/romaji.
* App icon: indigo tile, white ス, vermilion dot (a "stop" on the line: one station, one block).
* Copy is Traditional Chinese (Taiwan usage), friendly and brief; Japanese encouragement on the summary
  screen (すごい！／お疲れさま！／がんばろう！) with a Chinese subtitle.

### 7.5 Accessibility

Every control has an accessibility label and role; switches expose their state; option buttons expose
selected/disabled. Text uses the system font scale. Planned: VoiceOver and TalkBack audits, a large-font
layout pass, reduced-motion setting.

## 8. Technical architecture

### 8.1 Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 57** (React Native 0.86, React 19.2, TypeScript 6) | Develop on Windows; run on iPhone and Android via Expo Go; build both in the cloud with EAS |
| Navigation | Expo Router; native tabs (`NativeTabs`) | UITabBar on iOS, Material bottom navigation on Android, file-based routes |
| State | Zustand stores | Small, explicit, works with the React Compiler |
| Persistence | AsyncStorage, sharded | Simple and offline; writes are coalesced per key |
| Scheduling | ts-fsrs 5 | State-of-the-art spaced repetition, MIT |
| Speech | expo-speech (+ expo-audio session) | On-device, offline Japanese TTS |
| Haptics / icons | expo-haptics, expo-symbols (SF Symbols on iOS, Material Symbols on Android) | Native feel |
| Fonts | System fonts on iOS; Noto Sans JP subset on Android (expo-font) | Japanese glyph forms on every phone |
| Tests | Jest (jest-expo) | Engine and content are pure TypeScript |

### 8.2 Module map

```
src/app/            routes (screens): (tabs)/index, course, review, me · session · placement · onboarding · kana-chart
src/features/       quiz/ (prompts, options, item cards) · session/ (intro, question, summary, header) · VoiceHint
src/ui/             theme tokens, fonts, Txt, Ruby (furigana), controls, icons, tab bars (native + web)
src/state/          zustand stores (settings, progress, session, voice) · actions · storage · hooks
src/engine/         PURE LOGIC, unit-tested: blockBuilder · exercises · srs · adaptive · session · progress · placement · levels
src/content/        types · kana table · text/ruby helpers · registry · data/*.json (generated)
src/audio/          speech (voice selection and fallback, audio session)
src/lib/            haptics, confirm dialogs
content/            human-editable sources (TSV / txt)
assets/fonts/       Noto Sans JP subset (generated)
scripts/            build-content.ts (content + font subset)
```

Platform differences stay at the edges: `*.android.ts` / `*.web.tsx` files (fonts, tab bar) and a few
`Platform.OS` checks in `src/ui` and `src/audio`. Screens and the engine are shared.

UI → actions → engine (pure functions) → stores → storage. Screens never contain learning logic; the
engine never imports React Native. This keeps the part most likely to have bugs (scheduling, adaptivity,
block building) fast to test.

### 8.3 Persistence

| Key | Contents | Written |
|---|---|---|
| `settings:v1` | settings object | on change |
| `progress:meta:v1` | ability, daily stats, placement flag | after every answer |
| `progress:cards:<type>:v1` | FSRS cards for one item type (5 shards) | only the shard that changed |
| `session:v1` | current block (steps, options, answers, index) | after every answer / step |

Cards are stored as plain JSON with numeric timestamps, which ts-fsrs accepts directly. Keys are versioned
so future migrations can read old data.

### 8.4 Performance budget

Cold start (hydrate stores + index ~3,900 items) well under 1 s on a recent iPhone; step transitions are
synchronous state updates; content bundle about 1 MB of JSON. The Android JS bundle is 3.5 MB of Hermes
bytecode plus 1.5 MB of Japanese fonts; mid-range Android phones still need to be measured.

### 8.5 Quality

* `npm test` covers content integrity, furigana alignment, distractor validity across all levels,
  block composition, test-out, retries, resume after serialization, FSRS grading, ability updates,
  streaks, placement, and voice choice/fallback on Android and iOS (against a fake TTS engine).
* `npm run typecheck`, `npm run lint` and `npx expo-doctor` are clean; `npx expo export --platform android`
  bundles, and the generated Android manifest was checked with `npx expo config --type introspect`.
* The web build (`npm run web`) was used to click through every flow: onboarding, kana stage, N5/N1
  blocks, silent/sound switching mid-question, resume after reload, placement and dark mode.

### 8.6 Build and release

1. Development: `npx expo start`, then open it in **Expo Go** (iPhone: Camera app; Android: the scanner
   inside Expo Go).
2. Android test builds: `eas build -p android --profile preview` makes an APK that installs from a link.
3. Stores: `eas build -p ios|android` (production profile: App Store build / Play **AAB**, build numbers
   managed remotely by EAS), then `eas submit`. Android submits go to the Play **internal testing** track;
   the first AAB must be uploaded by hand in the Play Console. Needs unique `ios.bundleIdentifier` and
   `android.package` values plus Apple / Google Play developer accounts.
4. Over-the-air content/UI fixes: `eas update`.

### 8.7 Android specifics

| Topic | Decision |
|---|---|
| Japanese glyphs | Bundled Noto Sans JP subset; Regular and Bold are separate families because Android fakes bold for runtime-loaded fonts; `includeFontPadding: false` keeps furigana tight |
| Tab bar | Material bottom navigation with the app's own colours instead of Material You wallpaper colours, so the brand and contrast stay predictable |
| Edge-to-edge | Always on (Expo enables it on every Android version); tab screens pad for the status bar and draw a background-coloured scrim behind it; the root window colour follows light/dark so screen transitions don't flash white in dark mode |
| Back | Hardware back / back gesture handled per screen (§7.1); predictive back is off until those screens are adapted |
| Touch feedback | Material ripple on buttons and answer options |
| Speech | Locale passed as `ja` (expo-speech's Android locale parsing), on-device voices first, next voice on error, no playback without a Japanese voice (§3.4) |
| Permissions | Only INTERNET, VIBRATE and MODIFY_AUDIO_SETTINGS (no prompts); storage and overlay permissions from the template are removed |
| Backup | Android Auto Backup is left on, so progress follows the learner to a new phone through their Google backup |

## 9. Privacy and data

v1 has no account, no analytics and no network calls of its own; all progress stays on the device and in
the phone's own backup (iCloud / Google). Resetting in 我的 → 重設所有學習紀錄 deletes everything. Sync and
analytics (§11) would be opt-in and documented in the App Store privacy label and the Google Play data
safety form.

## 10. Success metrics

Measured with opt-in analytics in a later version:

* Activation: onboarding completion; first block finished within 60 s of install.
* Habit: D1 / D7 / D30 retention, blocks per active day, streak length distribution.
* Micro-learning fit: median block duration, **resume rate** (share of interrupted blocks resumed),
  abandonment by step.
* Learning: accuracy by level/skill, retention at review (FSRS true retention vs. 0.9 target), time to
  finish kana, share of 「太難」 feedback.

## 11. Roadmap

| Version | Scope |
|---|---|
| **v1.0 (this build)** | Everything above on iOS and Android: kana → N1 content, micro-blocks with resume, sound/silent, FSRS, adaptive difficulty, placement, 漢字陷阱, 五十音表, dark mode |
| v1.1 | 🎧 **耳朵模式 (hands-free audio)**: word → pause → meaning → example, with lock-screen controls and background audio for walking/driving · commute-time reminders (expo-notifications) · Home Screen & Lock Screen widgets on iOS, home-screen widgets on Android (今日一字, streak) · predictive back on Android · 音讀規則 module (Chinese → on'yomi correspondences, e.g. -ng → ウ/イ, 入聲 -k → ク/キ, especially helpful for Taiwanese/Cantonese speakers) · sentence-ordering exercise (並べ替え) |
| v1.2 | Full N3–N1 vocabulary and kanji via the content pipeline · recorded or neural audio for N3+ listening (also removes the dependence on installed voices) · reading passages (読解) · pitch-accent display |
| v2 | Speaking practice with speech recognition · accounts and cross-device sync (iPhone ↔ Android) · shareable decks · optional subscription for N3–N1 |

## 12. Risks and open questions

| Risk | Mitigation |
|---|---|
| Content accuracy: v1 content was written with AI assistance | Build-time validation plus unambiguous-quiz review; **native-speaker/teacher review before public release**; in-app 「回報錯誤」 button (v1.1) |
| JLPT lists are unofficial | Present levels as 「大約」; keep ids stable so regrading a level only changes difficulty |
| TTS quality for advanced listening | Enhanced voice auto-selection now; recorded/neural audio for N3+ (v1.2) |
| Android phones without Japanese voice data, and OEM TTS engines that behave differently | Detect and explain (§3.4), fall back between voices, silent questions meanwhile; test on Samsung (Samsung TTS) and Pixel (Google TTS) before release; bundled audio in v1.2 |
| Android not yet run on real hardware (built and checked from Windows without an emulator) | Before release: Expo Go on 2–3 phones (small screen, large font setting, 3-button navigation, dark mode), then an EAS preview APK |
| Data licensing when importing open data | Keep imported sources and attributions separate; CC BY-SA content stays share-alike |
| Expo Go limits (widgets, background audio need a dev build) | Ship v1 features that work in Expo Go; v1.1 moves to development builds via EAS |
| Theme switching while the app is open | Works via `useColorScheme` on device; verify on hardware (the web test harness could not emulate the change event) |

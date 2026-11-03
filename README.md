# スキマ日語 · Sukima Nihongo

零碎時間，一點一點學日語。A micro-learning Japanese app for Traditional Chinese speakers, for iPhone
and Android: 1–5 minute blocks you can stop at any moment, with or without sound, from kana to JLPT N1.

* **Micro-blocks** of 1 / 3 / 5 minutes; every answer is saved, so you resume on the exact question.
* **有聲／靜音**: listening questions when you have earphones, silent twins of the same questions when you don't.
* **Adaptive**: FSRS spaced repetition plus an Elo-style level estimate, a placement test,
  「太簡單／太難」 feedback, or pick a level yourself.
* **Built for Chinese speakers**: 新字體↔繁體 comparison, 漢字陷阱 (false friends), kana 字源,
  reading-first checks, Taiwan-standard translations.
* **Content**: 208 kana · 2,586 words · 796 kanji · 229 grammar points · 99 false friends across N5–N1.

The full product and technical design is in [docs/DESIGN.md](docs/DESIGN.md).

## Get it on your phone

No computer or app store needed. Both versions update from this repository: every push to `master`
deploys a new web app and builds a new APK.

### iPhone (or any phone): the web app

Open **https://sukima-nihongo.vercel.app** in Safari → Share → 加入主畫面 (Add to Home Screen), then open
スキマ日語 from the Home Screen. On Android: Chrome → ⋮ → Install app.

* It opens offline after the first visit.
* A new version installs itself the next time the app is opened online. The progress stays, and 今天 says
  so once.
* Progress is stored on the phone, and deleting the Home Screen app deletes it. Before that, or before
  changing phones, use 我的 → 資料 → 備份學習紀錄 (saves a file, e.g. to 「檔案」), then 從備份還原 in the
  new install.
* It is the web build: web tab bar, no vibration, and speech uses the browser's Japanese voice.

### Android: the APK

On the phone, download
**[sukima-nihongo.apk](https://github.com/fuyo1622/sukima-nihongo/releases/latest/download/sukima-nihongo.apk)**
(about 50 MB) and open it. Allow Chrome to install unknown apps when asked, and if Play Protect asks about the app,
choose to install anyway.

* This is the native app: Material tab bar, vibration, the phone's own Japanese voice and the bundled
  Japanese font.
* For a new version, download the APK again and install it over the old one: the progress stays. All
  versions are under [Releases](https://github.com/fuyo1622/sukima-nihongo/releases).
* Uninstalling the app deletes its progress. Back it up first (我的 → 資料 → 備份學習紀錄 shares it as
  text, e.g. to Google Keep or Drive), and paste it back with 從備份還原.
* Google plans to require registered developers for APKs on certified Android phones worldwide from 2027
  (already enforced in Brazil, Indonesia, Singapore and Thailand). Where that applies, the APK installs
  only through Android's "advanced flow" for apps from unverified developers.

### Japanese voice

Sound mode uses the phone's own text-to-speech, so it works offline. If the phone has no Japanese
voice, the app says so on 今天 and 我的, stops asking listening questions, and never falls back to a
Chinese voice.

* **iPhone**: usually has a Japanese voice already. For a better one: Settings → Accessibility → Spoken
  Content → Voices → Japanese → download an Enhanced voice. The app picks it automatically.
* **Android**: some phones have no Japanese voice data installed. 我的 then has a button that opens
  the text-to-speech settings; download 日文 for the engine (e.g. Speech Services by Google), then come
  back to the app. On-device voices are preferred over network ones.

## Develop

Requirements: Node 20+ (tested with Node 24). No Mac, Xcode or Android Studio needed.

```bash
npm install
npx expo start
```

Press `w` in the terminal to open the web version in the browser. To try the native app while developing,
open it in **Expo Go** on a phone on the same Wi-Fi (or run `npx expo start --tunnel`): on iPhone scan the
QR code with the Camera app, on Android scan it from inside Expo Go. Progress in Expo Go is separate from
the installed apps.

## How it's built and deployed

* **Web app**: Vercel builds every push to `master` with `npm run build:web` (settings in `vercel.json`)
  and serves it at https://sukima-nihongo.vercel.app. The service worker (`public/sw.js`) keeps it working
  offline and picks up new deploys. `npm run build:web` builds the same site into `dist/`.
* **Android APK**: GitHub Actions ([`.github/workflows/android.yml`](.github/workflows/android.yml)) builds
  a release APK on every push (`expo prebuild` + Gradle, no Expo account), installs it on an Android
  emulator and walks through onboarding, a block, 我的, a restart and an update (screenshots in the run's
  `emulator` artifact). On `master` it then publishes the APK as the latest release. The version code is
  the run number, and 我的 shows the commit (`app.config.ts`).
* **APK signing**: every APK is signed with the same key, so each one installs over the last and keeps the
  progress. The key is in the repository secrets `ANDROID_KEYSTORE_BASE64` and
  `ANDROID_KEYSTORE_PASSWORD`, set once with `bash scripts/android-signing.sh`, which keeps a copy in
  `~/.sukima-nihongo-signing` (keep that folder). Without the secrets, APKs are still built and tested, but
  not published.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Expo dev server (Expo Go / web) |
| `npm run android` | Dev server, opened on a connected Android phone or emulator (needs `adb`) |
| `npm run web` | Web preview |
| `npm run build:web` | Production web build with offline support in `dist/` (what Vercel deploys) |
| `npm test` | Unit tests (engine, content integrity) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build:content` | Validate `content/` and regenerate `src/content/data/*.json` |
| `npm run examples -- select` / `apply` | Pick example sentences from Tatoeba for words without one, then write the reviewed ones into `content/` |
| `bash scripts/android-signing.sh` | One-time: make the APK signing key and store it in the GitHub secrets |
| `python3 scripts/android-smoke.py <apk> <dir>` | Walk through the APK on a running emulator (what CI does) |

## Project layout

```
src/app/         screens (Expo Router): tabs 今天/課程/複習/我的, session, placement, onboarding, kana chart
src/features/    quiz and session UI, missing-voice hint
src/ui/          theme, fonts, furigana (Ruby), controls, icons, tab bars (native / web)
src/audio/       text-to-speech: voice choice, Android fallbacks
src/lib/         haptics, confirm dialogs
src/state/       zustand stores (settings, progress, session, voice), actions, storage
src/engine/      pure TypeScript learning logic (block builder, exercises, FSRS, adaptivity, placement) + tests
src/content/     content types, kana table, registry, generated data/
content/         editable sources: vocab/*.tsv, kanji/*.tsv, grammar/*.txt, traps.tsv (see content/README.md)
assets/fonts/    Noto Sans JP subset for Android (generated by build:content)
public/          web app page, Home Screen manifest and icons, offline service worker (sw.js)
scripts/         build-content.ts, import-examples.ts (Tatoeba), finalize-web.ts (web build),
                 android-signing.sh (APK key), android-smoke.py (emulator walkthrough)
docs/            DESIGN.md
.github/         workflows/android.yml: APK build, emulator walkthrough, release
app.config.ts    app.json plus the APK's version code and commit
eas.json         EAS Build profiles (store builds)
vercel.json      Vercel settings for the web app
```

## Editing content

Edit the TSV/text files in `content/` (they open in any spreadsheet app), then run
`npm run build:content`. The build refuses to write if anything is invalid, and it regenerates the
Android Japanese font subset when new characters appear. Format details and the plan for scaling to the
full N1 lists are in [content/README.md](content/README.md).

> The v1 learning content was written with AI assistance and passes automated checks, but it should be
> reviewed by a native speaker or teacher before public release.

## Credits

* Most vocabulary example sentences: [Tatoeba](https://tatoeba.org), CC BY 2.0 FR. Each example shows its
  author and links to the sentence; ids are kept in `content/vocab/*.tsv` (see content/README.md).
* Japanese font on Android: Noto Sans JP, SIL Open Font License (`assets/fonts/OFL.txt`).

## App Store and Google Play (EAS)

Not needed for the web app or the APK above. Store builds use EAS, which builds in the cloud, so both
platforms build from Windows; it needs an Expo account (`npx eas-cli@latest login`). Before the first store
build, decide on the final app IDs in `app.json` (`ios.bundleIdentifier` and `android.package`, today
`com.sukimanihongo.app`): changing `android.package` later makes Android treat it as a different app from the
APK, so progress would move over only through a backup. Build numbers are managed by EAS
(`appVersionSource: remote` in `eas.json`).

**iOS** (needs an Apple Developer account)

1. `npx eas-cli@latest build -p ios`
2. `npx eas-cli@latest submit -p ios` to upload to TestFlight / App Store Connect.

**Android** (needs a Google Play developer account)

* `npx eas-cli@latest build -p android` makes an **AAB** for Google Play.
* `npx eas-cli@latest submit -p android` uploads it to the Play Console **internal testing** track
  (set in `eas.json`). Google Play only accepts API uploads after the app's first upload, so upload the
  very first AAB by hand in the Play Console; automated submits also need a Google service account key.

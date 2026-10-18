This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## This project (スキマ日語)

- Design and rationale: `docs/DESIGN.md`. Content formats: `content/README.md`.
- Learning logic lives in `src/engine/` as pure TypeScript with Jest tests (`npm test`); keep React and
  Expo imports out of it. Screens call `src/state/actions.ts`, never the engine directly.
- `src/content/data/*.json` is generated: edit `content/` and run `npm run build:content`.
- UI copy is Traditional Chinese (Taiwan usage). Japanese text uses `lang="ja"` on `Txt` or the `Ruby`
  component so it renders with a Japanese font.
- Android: Japanese text must go through `Txt lang="ja"`, `Ruby` or `jaFont()` (theme.ts) to get the
  bundled Noto Sans JP subset; it has separate Regular/Bold families, so never set `fontWeight` on it
  directly. New Japanese UI strings go in `UI_JAPANESE` in `scripts/build-content.ts`, then
  `npm run build:content` regenerates the subset.
- Speech goes through `src/audio/speech.ts`, which picks a Japanese voice and never falls back to the
  phone's default (Chinese) voice; screens read voice availability from `src/state/voice.ts`.
- Android back button: full-screen flows handle it with `BackHandler` inside `useFocusEffect`.
- Run `npm test`, `npm run typecheck` and `npm run lint` before declaring a task done.

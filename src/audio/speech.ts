import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';
import { Linking, Platform } from 'react-native';

import { setVoiceStatus } from '@/state/voice';

/**
 * Japanese text-to-speech with the phone's own voices (AVSpeechSynthesizer on iOS, the system
 * TTS engine on Android). On-device voices are preferred so it keeps working in the subway.
 */

// expo-speech on Android builds the locale with `new Locale(language)`, which only understands a
// bare language code: 'ja-JP' would quietly fall back to the phone's default (Chinese) voice.
const LANGUAGE = Platform.OS === 'android' ? 'ja' : 'ja-JP';

let audioMode: Promise<void> | null = null;
let voices: string[] = []; // Japanese voice ids, best first
let failed = new Set<string>();
let lookup: Promise<void> | null = null;
let lookedUpAt = 0;
let generation = 0;

function setAudioMode(): Promise<void> {
  audioMode ??= (async () => {
    if (Platform.OS === 'web') return;
    try {
      // Sound mode is the learner's explicit choice, so play even with the ring/silent switch on,
      // mixed with whatever music or podcast is already playing.
      await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
    } catch (e) {
      console.warn('audio: could not set audio mode', e);
    }
  })();
  return audioMode;
}

/** Enhanced and on-device voices first; Android also lists network voices that fail offline. */
function rank(voice: Speech.Voice): number {
  let score = voice.quality === Speech.VoiceQuality.Enhanced ? 2 : 0;
  if (/network/i.test(voice.identifier)) score -= 3;
  if (/local/i.test(voice.identifier)) score += 1;
  return score;
}

/** Resolves to null if the promise takes longer than `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Finds the Japanese voices, e.g. again after the learner installed one in system settings. */
export function checkVoices(): Promise<void> {
  lookup ??= (async () => {
    // A TTS engine that never answers must not block playback forever.
    const all = await withTimeout(Speech.getAvailableVoicesAsync().catch(() => []), 5000);
    if (!all) return;
    voices = all
      .filter((v) => v.language?.toLowerCase().replace('_', '-').startsWith('ja'))
      .sort((a, b) => rank(b) - rank(a))
      .map((v) => v.identifier);
    failed = new Set();
    lookedUpAt = Date.now();
    setVoiceStatus(voices.length > 0 ? 'ready' : 'missing');
  })().finally(() => {
    lookup = null;
  });
  return lookup;
}

/** `onEnd` runs once the text has been spoken, or speaking it was stopped, failed or never started. */
function say(text: string, rate: number, gen: number, onEnd: () => void): void {
  const voice = voices.find((id) => !failed.has(id));
  // Without a Japanese voice the engine would read the kanji with Chinese pronunciation.
  if (!voice) return onEnd();
  Speech.speak(text, {
    language: LANGUAGE,
    voice,
    rate,
    onStart: () => setVoiceStatus('ready'),
    onDone: onEnd,
    onStopped: onEnd,
    onError: () => {
      // Android lists voices whose data is not downloaded yet and network voices that fail
      // offline: try the next one, and report the voice missing when none of them works.
      // An error after the learner moved on may just be the interruption, so it is ignored.
      if (Platform.OS !== 'android' || gen !== generation) return onEnd();
      failed.add(voice);
      if (voices.some((id) => !failed.has(id))) {
        say(text, rate, gen, onEnd);
      } else {
        failed = new Set();
        setVoiceStatus('missing');
        onEnd();
      }
    },
  });
}

/** Resolves when the text has been spoken (or stopped, failed, or replaced by newer speech). */
export function speak(text: string, rate = 1): Promise<void> {
  return new Promise((resolve) => {
    // A safety net: some engines (Safari) don't always report the end of speech.
    const timer = setTimeout(resolve, 2000 + (text.length * 400) / Math.max(rate, 0.25));
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    void start(text, rate, done);
  });
}

async function start(text: string, rate: number, onEnd: () => void): Promise<void> {
  if (!text) return onEnd();
  const gen = ++generation;
  await setAudioMode();
  if (voices.length === 0 && Date.now() - lookedUpAt > 10_000) await checkVoices();
  await Speech.stop();
  // A newer word, or leaving the screen, wins over a word still waiting here.
  if (gen === generation) say(text, rate, gen, onEnd);
  else onEnd();
}

export function stopSpeaking(): void {
  generation++;
  void Speech.stop();
}

/** Android only: the system text-to-speech settings, where Japanese voice data is downloaded. */
export function openVoiceSettings(): void {
  Linking.sendIntent('com.android.settings.TTS_SETTINGS').catch((e) => console.warn('could not open TTS settings', e));
}

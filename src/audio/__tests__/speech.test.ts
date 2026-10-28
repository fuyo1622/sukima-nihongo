/** Voice choice and failover, run against a fake TTS engine on each platform. */
type FakeVoice = { identifier: string; name: string; quality: 'Default' | 'Enhanced'; language: string };

const voice = (identifier: string, language = 'ja-JP', quality: FakeVoice['quality'] = 'Default'): FakeVoice => ({
  identifier,
  name: identifier,
  quality,
  language,
});

/** What speech.ts passes to expo-speech's `speak`. */
interface FakeOptions {
  language: string;
  voice: string;
  rate: number;
  onStart: () => void;
  onDone: () => void;
  onStopped: () => void;
  onError: (error: Error) => void;
}

/** `finishes`: the fake engine reports the end of each utterance right away (tests of the wait turn it off). */
function load(os: 'ios' | 'android', voices: FakeVoice[], { finishes = true } = {}) {
  const speak = jest.fn((_text: string, options: FakeOptions) => {
    if (finishes) queueMicrotask(() => options.onDone());
  });
  let loaded!: { speech: typeof import('../speech'); voice: typeof import('@/state/voice') };
  // A fresh copy of the module per test, so voice lists and failures don't leak between tests.
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      Platform: { OS: os },
      Linking: { sendIntent: jest.fn(() => Promise.resolve()) },
      TurboModuleRegistry: { get: () => null }, // looked up by expo-modules-core while loading
    }));
    jest.doMock('expo-audio', () => ({ setAudioModeAsync: jest.fn(() => Promise.resolve()) }));
    jest.doMock('expo-speech', () => ({
      VoiceQuality: { Default: 'Default', Enhanced: 'Enhanced' },
      getAvailableVoicesAsync: jest.fn(() => Promise.resolve(voices)),
      speak,
      stop: jest.fn(() => Promise.resolve()),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = { speech: require('../speech'), voice: require('@/state/voice') };
  });
  return {
    ...loaded,
    speak,
    status: () => loaded.voice.useVoice.getState().status,
    call: (i: number) => ({ text: speak.mock.calls[i][0] as string, options: speak.mock.calls[i][1] }),
  };
}

describe('speech on Android', () => {
  it('prefers an on-device voice and asks for the bare language code', async () => {
    const t = load('android', [
      voice('ja-jp-x-htm-network', 'ja-JP', 'Enhanced'),
      voice('ja-jp-x-htm-local'),
      voice('cmn-tw-x-ctc-local', 'zh-TW'),
    ]);
    await t.speech.speak('ねこ');
    expect(t.speak).toHaveBeenCalledTimes(1);
    expect(t.call(0).text).toBe('ねこ');
    expect(t.call(0).options).toMatchObject({ language: 'ja', voice: 'ja-jp-x-htm-local' });
    expect(t.status()).toBe('ready');
  });

  it('stays silent without a Japanese voice instead of using the Chinese default', async () => {
    const t = load('android', [voice('cmn-tw-x-ctc-local', 'zh-TW')]);
    await t.speech.speak('日本');
    expect(t.speak).not.toHaveBeenCalled();
    expect(t.status()).toBe('missing');
  });

  it('falls back to the next voice when one fails, and reports missing when all fail', async () => {
    const t = load('android', [voice('ja-jp-x-htm-local'), voice('ja-jp-x-htm-network')]);
    await t.speech.speak('いぬ');
    t.call(0).options.onError(new Error('not installed'));
    expect(t.speak).toHaveBeenCalledTimes(2);
    expect(t.call(1)).toMatchObject({ text: 'いぬ', options: { voice: 'ja-jp-x-htm-network' } });
    expect(t.status()).toBe('ready');

    t.call(1).options.onError(new Error('offline'));
    expect(t.speak).toHaveBeenCalledTimes(2);
    expect(t.status()).toBe('missing');

    // Every voice gets another chance on the next word, and a voice that plays clears the warning.
    await t.speech.speak('とり');
    expect(t.call(2).options.voice).toBe('ja-jp-x-htm-local');
    t.call(2).options.onStart();
    expect(t.status()).toBe('ready');
  });

  it('plays only the latest of two quick taps', async () => {
    const t = load('android', [voice('ja-jp-x-htm-local')]);
    await Promise.all([t.speech.speak('いぬ'), t.speech.speak('ねこ')]);
    expect(t.speak).toHaveBeenCalledTimes(1);
    expect(t.call(0).text).toBe('ねこ');
  });

  it('ignores errors from a word the learner has already moved past', async () => {
    const t = load('android', [voice('ja-jp-x-htm-local'), voice('ja-jp-x-htm-network')]);
    await t.speech.speak('いぬ');
    t.speech.stopSpeaking();
    t.call(0).options.onError(new Error('interrupted'));
    expect(t.speak).toHaveBeenCalledTimes(1);
    await t.speech.speak('とり');
    expect(t.call(1).options.voice).toBe('ja-jp-x-htm-local');
  });
});

describe('waiting for speech to finish', () => {
  afterEach(() => jest.useRealTimers());

  // The next question waits for this, so the answer is heard to the end.
  it('resolves when the engine reports the end, not when speech starts', async () => {
    const t = load('ios', [voice('com.apple.voice.compact.ja-JP.Kyoko')], { finishes: false });
    let ended = false;
    const spoken = t.speech.speak('この服はちょっと安っぽく見える。').then(() => (ended = true));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(t.speak).toHaveBeenCalledTimes(1);
    expect(ended).toBe(false);
    t.call(0).options.onDone();
    await spoken;
    expect(ended).toBe(true);
  });

  it('resolves when speech is stopped, replaced by a newer word, or impossible', async () => {
    const t = load('ios', [voice('com.apple.voice.compact.ja-JP.Kyoko')], { finishes: false });
    const first = t.speech.speak('いぬ');
    const second = t.speech.speak('ねこ');
    await first; // replaced before it started
    await new Promise((resolve) => setTimeout(resolve, 0));
    t.call(0).options.onStopped();
    await second;

    const silent = load('ios', [voice('com.apple.voice.compact.zh-TW.Meijia', 'zh-TW')], { finishes: false });
    await silent.speech.speak('日本'); // no Japanese voice: nothing to wait for
    expect(silent.speak).not.toHaveBeenCalled();
  });

  it('stops waiting after a while if the engine never reports the end', async () => {
    jest.useFakeTimers();
    const t = load('ios', [voice('com.apple.voice.compact.ja-JP.Kyoko')], { finishes: false });
    let ended = false;
    void t.speech.speak('ねこ').then(() => (ended = true));
    await jest.advanceTimersByTimeAsync(2000);
    expect(t.speak).toHaveBeenCalledTimes(1);
    expect(ended).toBe(false);
    await jest.advanceTimersByTimeAsync(1000); // 2 s plus 0.4 s per character
    expect(ended).toBe(true);
  });
});

describe('speech on iOS', () => {
  it('uses the enhanced Japanese voice with the full locale', async () => {
    const t = load('ios', [voice('com.apple.voice.compact.ja-JP.Kyoko'), voice('com.apple.voice.enhanced.ja-JP.Kyoko', 'ja-JP', 'Enhanced')]);
    await t.speech.speak('さくら', 0.75);
    expect(t.call(0).options).toMatchObject({ language: 'ja-JP', voice: 'com.apple.voice.enhanced.ja-JP.Kyoko', rate: 0.75 });
  });

  it('ignores engine errors: iOS voices are on the device', async () => {
    const t = load('ios', [voice('com.apple.voice.compact.ja-JP.Kyoko')]);
    await t.speech.speak('さくら');
    t.call(0).options.onError(new Error());
    expect(t.speak).toHaveBeenCalledTimes(1);
    expect(t.status()).toBe('ready');
  });
});

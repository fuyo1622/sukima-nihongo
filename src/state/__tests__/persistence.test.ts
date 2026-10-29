/** Progress survives app updates, unreadable saves, and (with a backup) deleting the app. */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ITEMS_BY_TYPE } from '@/content';
import { emptyProgress } from '@/engine/progress';
import { newCard } from '@/engine/srs';

import { hydrateStores } from '../actions';
import { noteBuild, useAppUpdate } from '../appUpdate';
import { createBackup, describeBackup, parseBackup, restoreBackup } from '../backup';
import { useProgress } from '../progress';
import { useSession } from '../session';
import { DEFAULT_SETTINGS, useSettings } from '../settings';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const NOW = new Date(2026, 9, 29, 8, 0).getTime();
/** Lets the queued storage writes finish. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** What a fresh app start sees: empty stores, then whatever storage holds. */
async function restart() {
  useProgress.setState({ data: emptyProgress() });
  useSettings.setState({ settings: DEFAULT_SETTINGS });
  useSession.setState({ session: null });
  await hydrateStores();
}

/** A learner who has studied one item of each type over two days. */
async function study() {
  const ids = Object.values(ITEMS_BY_TYPE).map((items) => items[0].id);
  const cards = Object.fromEntries(ids.map((id) => [id, newCard(NOW)]));
  const days = {
    '2026-10-28': { blocks: 2, answers: 20, correct: 17, newItems: 6, ms: 300_000 },
    '2026-10-29': { blocks: 1, answers: 10, correct: 9, newItems: 3, ms: 150_000 },
  };
  useProgress.getState().commit({ ...emptyProgress(), cards, days, placementDone: true });
  useSettings.getState().update({ onboarded: true, dailyGoal: 5, sound: false });
  await settle();
  return { ids, cards };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  await restart();
  useAppUpdate.setState({ updated: false });
});

describe('progress across app versions', () => {
  it('is still there after the app restarts (what an update does)', async () => {
    const { cards } = await study();
    await restart();
    expect(useProgress.getState().data.cards).toEqual(cards);
    expect(useSettings.getState().settings).toMatchObject({ dailyGoal: 5, sound: false });
  });

  it('keeps the cards even when the summary record is missing', async () => {
    const { cards } = await study();
    await AsyncStorage.removeItem('sukima:progress:meta:v1');
    await restart();
    expect(useProgress.getState().data.cards).toEqual(cards);
  });

  it('sets an unreadable save aside instead of letting the next save destroy it', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await AsyncStorage.setItem('sukima:settings:v1', '{"onboarded": tr');
    await restart();
    expect(useSettings.getState().settings).toEqual(DEFAULT_SETTINGS);
    expect(await AsyncStorage.getItem('sukima:unreadable:settings:v1')).toBe('{"onboarded": tr');
    jest.restoreAllMocks();
  });

  it('says once after an update that the progress was kept', async () => {
    noteBuild('build-1'); // first run of the web app: nothing to announce
    expect(useAppUpdate.getState().updated).toBe(false);
    await study();
    noteBuild('build-1');
    expect(useAppUpdate.getState().updated).toBe(false);
    noteBuild('build-2');
    expect(useAppUpdate.getState().updated).toBe(true);
    expect(useSettings.getState().settings.lastBuild).toBe('build-2');
    noteBuild(null); // the native app and the dev server have no build id
    expect(useSettings.getState().settings.lastBuild).toBe('build-2');
  });
});

describe('backup and restore', () => {
  it('brings everything back after the app was deleted and installed again', async () => {
    const { cards } = await study();
    const file = JSON.stringify(createBackup(NOW));

    await AsyncStorage.clear(); // deleting a Home Screen web app deletes its storage
    await restart();
    expect(useProgress.getState().data.cards).toEqual({});

    const parsed = parseBackup(file);
    if ('error' in parsed) throw new Error(parsed.error);
    expect(describeBackup(parsed.backup)).toBe('2026-10-29 的備份：學過 5 個項目，學了 2 天。');
    restoreBackup(parsed.backup);
    await settle();

    await restart(); // the restored progress was saved, not just shown
    const { data } = useProgress.getState();
    expect(data.cards).toEqual(cards);
    expect(Object.keys(data.days)).toEqual(['2026-10-28', '2026-10-29']);
    expect(data.placementDone).toBe(true);
    expect(useSettings.getState().settings).toMatchObject({ onboarded: true, dailyGoal: 5, sound: false, lastBackupAt: NOW });
  });

  it('refuses files it cannot restore, with a reason', () => {
    const backup = JSON.parse(JSON.stringify(createBackup(NOW)));
    const reason = (text: string) => {
      const parsed = parseBackup(text);
      return 'error' in parsed ? parsed.error : null;
    };
    expect(reason('not a backup')).toContain('不是');
    expect(reason(JSON.stringify({ ...backup, app: 'other-app' }))).toContain('不是');
    expect(reason(JSON.stringify({ ...backup, format: 99 }))).toContain('較新版本');
    expect(reason(JSON.stringify({ ...backup, progress: { v: 1 } }))).toContain('不完整');
    expect(reason(JSON.stringify(backup))).toBeNull();
  });

  it('fills in settings added after the backup was made', () => {
    const backup = JSON.parse(JSON.stringify(createBackup(NOW)));
    delete backup.settings.autoAdvance;
    delete backup.settings.focus.kanji;
    const parsed = parseBackup(JSON.stringify(backup));
    if ('error' in parsed) throw new Error(parsed.error);
    expect(parsed.backup.settings.autoAdvance).toBe(DEFAULT_SETTINGS.autoAdvance);
    expect(parsed.backup.settings.focus.kanji).toBe(true);
  });
});

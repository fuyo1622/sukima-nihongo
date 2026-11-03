import { Alert, Platform, Share } from 'react-native';

import { saveBackupFile } from '../backupFile';

type Answer = '存好了' | '還沒';

/** Shares with the given outcome on `os`; when the app asks whether the backup was kept, answers `answer`. */
async function save(os: 'ios' | 'android', action: typeof Share.sharedAction | typeof Share.dismissedAction, answer: Answer = '存好了') {
  jest.restoreAllMocks();
  jest.replaceProperty(Platform, 'OS', os);
  jest.spyOn(Share, 'share').mockResolvedValue({ action });
  const ask = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text === answer)?.onPress?.();
  });
  const saved = await saveBackupFile('sukima-nihongo-2026-11-03.json', '{}');
  return { saved, asked: ask.mock.calls.map(([title]) => title) };
}

afterEach(() => jest.restoreAllMocks());

describe('saveBackupFile (native)', () => {
  test('iPhone: trusts the share sheet, which reports a cancel', async () => {
    expect(await save('ios', Share.sharedAction)).toEqual({ saved: true, asked: [] });
    expect(await save('ios', Share.dismissedAction)).toEqual({ saved: false, asked: [] });
  });

  test('Android reports every share as done, so the app asks before recording the backup', async () => {
    expect(await save('android', Share.sharedAction, '存好了')).toEqual({ saved: true, asked: ['備份存好了嗎？'] });
    expect(await save('android', Share.sharedAction, '還沒')).toEqual({ saved: false, asked: ['備份存好了嗎？'] });
  });
});

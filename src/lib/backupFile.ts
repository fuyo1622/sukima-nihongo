import { Platform, Share } from 'react-native';

import { confirmAsync } from './confirm';

/**
 * Native app: hands the backup text to the system share sheet (save to Files or Notes, AirDrop,
 * LINE…). Restoring is done by pasting it back (我的 → 從備份還原), so no file module is needed.
 */
export async function saveBackupFile(name: string, json: string): Promise<boolean> {
  const result = await Share.share({ title: name, message: json });
  if (result.action !== Share.sharedAction) return false;
  // Android reports every share sheet as shared, even one closed without choosing an app, so ask.
  // The question shows once the learner is back from the share sheet.
  if (Platform.OS === 'android') {
    return confirmAsync('備份存好了嗎？', '存好了才會記下這次的備份日期。', '存好了', false, '還沒');
  }
  return true;
}

/** Whether restoring can open a file picker; otherwise 我的 asks to paste the backup. */
export const canPickBackupFile = false;

export async function pickBackupFile(): Promise<string | null> {
  return null;
}

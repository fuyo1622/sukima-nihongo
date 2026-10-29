/**
 * Web app: saves the backup as a .json file. Phones get the share sheet (iPhone: 儲存到「檔案」,
 * AirDrop, LINE…); browsers that can't share files download it.
 */
export async function saveBackupFile(name: string, json: string): Promise<boolean> {
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return true;
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return false;
      // Sharing failed for another reason: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return true;
}

/** Whether restoring can open a file picker; otherwise 我的 asks to paste the backup. */
export const canPickBackupFile = true;

/** Lets the learner choose a backup file; resolves to its text, or null when cancelled. */
export function pickBackupFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve, () => resolve(null));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

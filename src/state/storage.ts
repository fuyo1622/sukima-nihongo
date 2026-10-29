import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'sukima:';

// Latest value waiting to be written per key (null = delete).
const pending = new Map<string, string | null>();
const writing = new Set<string>();

export async function loadJSON<T>(key: string): Promise<T | null> {
  let raw: string | null = null;
  try {
    raw = await AsyncStorage.getItem(PREFIX + key);
    return raw == null ? null : (JSON.parse(raw) as T);
  } catch (e) {
    console.warn(`storage: could not read ${key}`, e);
    // Set the unreadable value aside: the next save would otherwise destroy what might still be recovered.
    if (raw != null) await AsyncStorage.setItem(`${PREFIX}unreadable:${key}`, raw).catch(() => undefined);
    return null;
  }
}

/**
 * Queues a write. Writes to the same key run one at a time and coalesce, so a burst of
 * answers turns into at most one write in flight plus the latest value.
 */
export function saveJSON(key: string, value: unknown): void {
  pending.set(key, JSON.stringify(value));
  if (!writing.has(key)) void flush(key);
}

export function removeKey(key: string): void {
  pending.set(key, null);
  if (!writing.has(key)) void flush(key);
}

async function flush(key: string): Promise<void> {
  writing.add(key);
  try {
    while (pending.has(key)) {
      const value = pending.get(key) ?? null;
      pending.delete(key);
      if (value === null) await AsyncStorage.removeItem(PREFIX + key);
      else await AsyncStorage.setItem(PREFIX + key, value);
    }
  } catch (e) {
    console.warn(`storage: could not write ${key}`, e);
  } finally {
    writing.delete(key);
  }
}

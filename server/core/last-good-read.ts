/**
 * Small, process-local recovery cache for public read projections.
 *
 * It is intentionally not a source of truth. Only a complete successful read
 * is stored; an expired or missing value rethrows the original failure.
 */
export type LastGoodValue<T> = { value: T; savedAt: number };

export const LAST_GOOD_READ_TTL_MS = 24 * 60 * 60 * 1000;

export async function withLastGoodRead<T>(
  key: string,
  read: () => Promise<T>,
  cache: Map<string, LastGoodValue<T>>,
  now = Date.now,
): Promise<T> {
  try {
    const value = await read();
    cache.set(key, { value, savedAt: now() });
    return value;
  } catch (cause) {
    const saved = cache.get(key);
    if (saved && now() - saved.savedAt <= LAST_GOOD_READ_TTL_MS) return saved.value;
    throw cause;
  }
}

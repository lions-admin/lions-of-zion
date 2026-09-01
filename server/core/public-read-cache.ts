import "server-only";

type Entry<T> = { value: T; expiresAt: number };

const TTL_MS = 5 * 60 * 1000;
const entries = new Map<string, Entry<unknown>>();
const stats = { hits: 0, misses: 0, loads: 0, totalLoadMs: 0 };

export async function publicReadCache<T>(key: string, load: () => Promise<T>): Promise<T> {
  const current = entries.get(key);
  if (current && current.expiresAt > Date.now()) {
    stats.hits++;
    return current.value as T;
  }
  stats.misses++;
  const started = Date.now();
  const value = await load();
  stats.loads++;
  stats.totalLoadMs += Date.now() - started;
  entries.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function clearPublicReadCache(): void {
  entries.clear();
}

export function publicReadCacheStats() {
  const requests = stats.hits + stats.misses;
  return {
    hits: stats.hits,
    misses: stats.misses,
    hitRatio: requests === 0 ? null : stats.hits / requests,
    loads: stats.loads,
    averageLoadMs: stats.loads === 0 ? null : Math.round(stats.totalLoadMs / stats.loads),
  };
}

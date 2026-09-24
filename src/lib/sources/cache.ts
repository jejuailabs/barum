type Entry<T> = {value?: T; expiresAt: number; pending?: Promise<T>};

const entries = new Map<string, Entry<unknown>>();
let hits = 0;
let misses = 0;

export async function withSourceCache<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<{value: T; status: 'HIT' | 'MISS'}> {
  const now = Date.now();
  const existing = entries.get(key) as Entry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    hits += 1;
    return {value: existing.value, status: 'HIT'};
  }
  if (existing?.pending) {
    hits += 1;
    return {value: await existing.pending, status: 'HIT'};
  }
  misses += 1;
  const pending = loader();
  entries.set(key, {expiresAt: now + ttlSec * 1000, pending});
  try {
    const value = await pending;
    entries.set(key, {value, expiresAt: Date.now() + ttlSec * 1000});
    return {value, status: 'MISS'};
  } catch (error) {
    entries.delete(key);
    throw error;
  }
}

export function getSourceCacheStats() {
  const total = hits + misses;
  return {hits, misses, hitRate: total ? hits / total : 0, entries: entries.size};
}

export function resetSourceCache() {
  entries.clear(); hits = 0; misses = 0;
}

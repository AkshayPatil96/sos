/**
 * Cache abstraction interface.
 * All modules must use this interface — never import a concrete implementation directly.
 *
 * To add Redis: implement ICache in lib/cache/redis.cache.ts,
 * then swap the export below based on REDIS_URL env var.
 */
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
  remember<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T>;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * In-memory cache implementation using a Map.
 * Process-scoped — does not survive restarts.
 *
 * To add Redis: implement ICache in lib/cache/redis.cache.ts,
 * then swap the export below based on REDIS_URL env var.
 */
class InMemoryCache implements ICache {
  private readonly store = new Map<string, CacheEntry>();

  get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return Promise.resolve(null);

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return Promise.resolve(null);
    }

    return Promise.resolve(entry.value as T);
  }

  set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
    return Promise.resolve();
  }

  del(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  delByPattern(pattern: string): Promise<void> {
    for (const key of this.store.keys()) {
      if (key.startsWith(pattern)) {
        this.store.delete(key);
      }
    }
    return Promise.resolve();
  }

  async remember<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    await this.set(key, value, ttlSeconds);
    return value;
  }
}

// To add Redis: create RedisCache implementing ICache, swap here
export const cache: ICache = new InMemoryCache();

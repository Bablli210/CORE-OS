import { platform } from "../../platform";

/**
 * Last good copy of what the client screens read (the logger's program and "last time", Today) and the workout in progress.
 * With no signal the screens open from here; the server copy replaces it as soon as a fetch succeeds.
 */
const cache = () => platform().kv("gymos-cache");

export const readCache = <T>(key: string) => cache().get<T>(key).catch(() => undefined);
export const writeCache = <T>(key: string, value: T) => cache().set(key, value).catch(() => undefined);
export const clearCacheKey = (key: string) => cache().del(key).catch(() => undefined);

/**
 * Network first, cache as fallback: the fresh answer is stored; if the network fails and a copy exists, the copy is used
 * (marked, so the screen can say it may be out of date).
 */
export async function networkFirst<T extends object>(key: string, load: () => Promise<T>, isNetworkError: (e: unknown) => boolean): Promise<T & { fromCache?: boolean }> {
  try {
    const fresh: T = await load();
    await writeCache(key, fresh);
    return fresh as T & { fromCache?: boolean };
  } catch (e) {
    const copy = isNetworkError(e) ? await readCache<T>(key) : undefined;
    if (copy !== undefined) return { ...copy, fromCache: true };
    throw e;
  }
}

/** Sign-out on a shared phone: forget the cached data (the web also drops its service-worker caches). The outbox is kept: queued workouts stay until they are sent. */
export async function clearClientCaches(): Promise<void> {
  await cache().clear().catch(() => undefined);
}

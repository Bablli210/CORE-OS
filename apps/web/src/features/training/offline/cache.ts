import { createStore, del, get, set, type UseStore } from "idb-keyval";

/**
 * Last good copy of what the client screens read (the logger's program and "last time", Today) and the workout in progress.
 * With no signal the screens open from here; the server copy replaces it as soon as a fetch succeeds.
 */
let store: UseStore | null = null;
const cache = () => (store ??= createStore("gymos-cache", "entries"));

export const readCache = <T>(key: string) => get<T>(key, cache()).catch(() => undefined);
export const writeCache = <T>(key: string, value: T) => set(key, value, cache()).catch(() => undefined);
export const clearCacheKey = (key: string) => del(key, cache()).catch(() => undefined);

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

/** Sign-out on a shared phone: forget the cached pages and data. The outbox is kept: queued workouts stay until they are sent. */
export async function clearClientCaches(): Promise<void> {
  try {
    indexedDB.deleteDatabase("gymos-cache");
    if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* nothing cached */
  }
}

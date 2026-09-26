/**
 * What the shared layer needs from the device, so the same hooks run in the browser (Next.js) and on the phone (Expo):
 * - `storage`: small synchronous key/value (localStorage on the web; an AsyncStorage-backed mirror on the phone) for the
 *   coach's queued attendance taps;
 * - `kv(name)`: an async key/value store (IndexedDB on the web; AsyncStorage on the phone) for the client's outbox and
 *   offline cache;
 * - `connectivity`: online now, and a subscription to changes;
 * - `setInterval` / `clearInterval` for the retry timers.
 * Each app calls configurePlatform() once at startup, before any hook runs.
 */
export type SyncStorage = { getItem(key: string): string | null; setItem(key: string, value: string): void };
export type AsyncKV = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  del(key: string): Promise<void>;
  entries<T>(): Promise<[string, T][]>;
  /** Forget every entry (sign-out on a shared phone). */
  clear(): Promise<void>;
};
export type Connectivity = { isOnline(): boolean; subscribe(listener: (online: boolean) => void): () => void };
export type Platform = { storage: SyncStorage | null; kv(name: string): AsyncKV; connectivity: Connectivity };

let current: Platform | null = null;

export function configurePlatform(p: Platform): void {
  current = p;
}

export function platform(): Platform {
  if (!current) throw new Error("@gymos/api: configurePlatform() was not called at app start");
  return current;
}

/** An in-memory platform: server renders, tests, and anything that runs before the app configured the real one. */
export function memoryPlatform(): Platform {
  const stores = new Map<string, Map<string, unknown>>();
  const sync = new Map<string, string>();
  return {
    storage: { getItem: (k) => sync.get(k) ?? null, setItem: (k, v) => void sync.set(k, v) },
    kv(name) {
      const m = stores.get(name) ?? new Map<string, unknown>();
      stores.set(name, m);
      return {
        get: async <T,>(k: string) => m.get(k) as T | undefined,
        set: async (k, v) => void m.set(k, v),
        del: async (k) => void m.delete(k),
        entries: async <T,>() => [...m.entries()] as [string, T][],
        clear: async () => m.clear(),
      };
    },
    connectivity: { isOnline: () => true, subscribe: () => () => {} },
  };
}

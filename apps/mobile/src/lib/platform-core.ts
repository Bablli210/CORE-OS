import type { AsyncKV, Platform } from "@gymos/api/platform";

/** The slice of AsyncStorage the platform uses (injected, so this file has no native imports and is unit-tested). */
export type AsyncStorageLike = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiRemove(keys: readonly string[]): Promise<void>;
};
export type NetState = { isConnected: boolean | null };
export type NetInfoLike = { addEventListener(listener: (state: NetState) => void): () => void };

const SYNC = "gymos.sync:";

type BrowserLike = {
  navigator: { onLine: boolean };
  addEventListener(type: "online" | "offline", listener: () => void): void;
  removeEventListener(type: "online" | "offline", listener: () => void): void;
};

/**
 * Connectivity for the app's web build. NetInfo's web module listens to `navigator.connection` "change" whenever that
 * API exists and then ignores the online/offline events, which not every browser fires together (headless Chromium
 * going offline fires only online/offline). The browser's own flag and events are the reliable signal on web.
 */
export function browserNetInfo(win: BrowserLike): NetInfoLike {
  return {
    addEventListener(listener) {
      const emit = () => listener({ isConnected: win.navigator.onLine });
      win.addEventListener("online", emit);
      win.addEventListener("offline", emit);
      emit(); // like NetInfo: the current state at once
      return () => {
        win.removeEventListener("online", emit);
        win.removeEventListener("offline", emit);
      };
    },
  };
}

/**
 * The phone's side of @gymos/api/platform:
 * - storage: a synchronous mirror of AsyncStorage keys under `gymos.sync:` (the coach's queued taps). hydrate() loads
 *   it before the first screen; writes go to the mirror at once and to AsyncStorage behind it.
 * - kv(name): AsyncStorage keys under `<name>:` with JSON values (the client's outbox and offline cache).
 * - connectivity: NetInfo's isConnected (unknown counts as online; no reachability pings).
 */
export function createNativePlatform(store: AsyncStorageLike, netinfo: NetInfoLike): Platform & { hydrate(): Promise<void> } {
  const mirror = new Map<string, string>();
  let online = true;
  netinfo.addEventListener((s) => {
    online = s.isConnected !== false;
  });

  const kv = (name: string): AsyncKV => {
    const prefix = `${name}:`;
    const keys = async () => (await store.getAllKeys()).filter((k) => k.startsWith(prefix));
    return {
      async get<T>(key: string) {
        const raw = await store.getItem(prefix + key);
        return raw === null ? undefined : (JSON.parse(raw) as T);
      },
      set: (key, value) => store.setItem(prefix + key, JSON.stringify(value)),
      del: (key) => store.removeItem(prefix + key),
      async entries<T>() {
        const pairs = await store.multiGet(await keys());
        return pairs.filter(([, v]) => v !== null).map(([k, v]) => [k.slice(prefix.length), JSON.parse(v as string) as T] as [string, T]);
      },
      clear: async () => store.multiRemove(await keys()),
    };
  };

  return {
    async hydrate() {
      const keys = (await store.getAllKeys()).filter((k) => k.startsWith(SYNC));
      for (const [k, v] of await store.multiGet(keys)) if (v !== null) mirror.set(k.slice(SYNC.length), v);
    },
    storage: {
      getItem: (k) => mirror.get(k) ?? null,
      setItem: (k, v) => {
        mirror.set(k, v);
        void store.setItem(SYNC + k, v).catch(() => undefined);
      },
    },
    kv,
    connectivity: {
      isOnline: () => online,
      subscribe: (listener) => netinfo.addEventListener((s) => listener(s.isConnected !== false)),
    },
  };
}

import { configurePlatform, memoryPlatform, type AsyncKV } from "@gymos/api/platform";
import { clear, createStore, del, entries, get, set, type UseStore } from "idb-keyval";

/**
 * The browser's side of @gymos/api/platform: localStorage for the coach's queued taps, IndexedDB (idb-keyval) for the
 * client's outbox and offline cache — the same stores as before M8, so nothing queued on a phone is lost — and the
 * window's online/offline events. On the server (SSR) an in-memory platform stands in; no hook runs there.
 */
const stores = new Map<string, UseStore>();
function idb(name: string): AsyncKV {
  const store = () => {
    let s = stores.get(name);
    if (!s) stores.set(name, (s = createStore(name, name === "gymos-outbox" ? "items" : "entries")));
    return s;
  };
  return {
    get: <T,>(k: string) => get<T>(k, store()),
    set: (k, v) => set(k, v, store()),
    del: (k) => del(k, store()),
    entries: <T,>() => entries<string, T>(store()),
    clear: () => clear(store()),
  };
}

export function configureWebPlatform() {
  if (typeof window === "undefined") {
    configurePlatform(memoryPlatform());
    return;
  }
  configurePlatform({
    storage: window.localStorage,
    kv: idb,
    connectivity: {
      isOnline: () => navigator.onLine,
      subscribe(listener) {
        const up = () => listener(true);
        const down = () => listener(false);
        window.addEventListener("online", up);
        window.addEventListener("offline", down);
        return () => {
          window.removeEventListener("online", up);
          window.removeEventListener("offline", down);
        };
      },
    },
  });
}

configureWebPlatform();

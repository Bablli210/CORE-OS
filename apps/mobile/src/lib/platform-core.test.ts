import { describe, expect, it } from "vitest";
import { browserNetInfo, createNativePlatform, type AsyncStorageLike, type NetState } from "./platform-core";

function fakeStorage(seed: Record<string, string> = {}): AsyncStorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => void data.set(k, v),
    removeItem: async (k) => void data.delete(k),
    getAllKeys: async () => [...data.keys()],
    multiGet: async (keys) => keys.map((k) => [k, data.get(k) ?? null] as const),
    multiRemove: async (keys) => keys.forEach((k) => data.delete(k)),
  };
}
function fakeNet() {
  const listeners = new Set<(s: NetState) => void>();
  return {
    emit: (s: NetState) => listeners.forEach((l) => l(s)),
    addEventListener: (l: (s: NetState) => void) => (listeners.add(l), () => listeners.delete(l)),
  };
}

describe("the phone's platform", () => {
  it("keeps the coach's queued taps across restarts (sync mirror hydrated from AsyncStorage)", async () => {
    const store = fakeStorage({ "gymos.sync:gymos.outcomes.v1": "[1]", other: "x" });
    const p = createNativePlatform(store, fakeNet());
    expect(p.storage!.getItem("gymos.outcomes.v1")).toBeNull();
    await p.hydrate();
    expect(p.storage!.getItem("gymos.outcomes.v1")).toBe("[1]");
    p.storage!.setItem("gymos.outcomes.v1", "[2]");
    expect(p.storage!.getItem("gymos.outcomes.v1")).toBe("[2]");
    await Promise.resolve();
    expect(store.data.get("gymos.sync:gymos.outcomes.v1")).toBe("[2]");
  });

  it("gives each store its own key space, JSON in and out, and clears only its own keys", async () => {
    const store = fakeStorage();
    const p = createNativePlatform(store, fakeNet());
    await p.kv("gymos-outbox").set("w1", { kind: "workout", n: 1 });
    await p.kv("gymos-cache").set("home", { a: 1 });
    expect(await p.kv("gymos-outbox").get("w1")).toEqual({ kind: "workout", n: 1 });
    expect(await p.kv("gymos-outbox").entries()).toEqual([["w1", { kind: "workout", n: 1 }]]);
    await p.kv("gymos-cache").clear();
    expect(await p.kv("gymos-cache").get("home")).toBeUndefined();
    expect(await p.kv("gymos-outbox").get("w1")).toBeDefined();
  });

  it("follows NetInfo; unknown connectivity counts as online", () => {
    const net = fakeNet();
    const p = createNativePlatform(fakeStorage(), net);
    const seen: boolean[] = [];
    p.connectivity.subscribe((o) => seen.push(o));
    net.emit({ isConnected: false });
    expect(p.connectivity.isOnline()).toBe(false);
    net.emit({ isConnected: null });
    expect(p.connectivity.isOnline()).toBe(true);
    expect(seen).toEqual([false, true]);
  });
});

describe("the web build's connectivity", () => {
  it("follows the browser's online flag and events, and stops on unsubscribe", () => {
    const handlers = new Map<string, Set<() => void>>();
    const win = {
      navigator: { onLine: true },
      addEventListener: (t: string, l: () => void) => void (handlers.get(t) ?? handlers.set(t, new Set()).get(t)!).add(l),
      removeEventListener: (t: string, l: () => void) => void handlers.get(t)?.delete(l),
    };
    const fire = (t: "online" | "offline") => ((win.navigator.onLine = t === "online"), handlers.get(t)?.forEach((l) => l()));
    const p = createNativePlatform(fakeStorage(), browserNetInfo(win));
    const seen: boolean[] = [];
    const off = p.connectivity!.subscribe((up) => seen.push(up));
    expect(p.connectivity!.isOnline()).toBe(true);
    fire("offline");
    expect(p.connectivity!.isOnline()).toBe(false);
    fire("online");
    off();
    fire("offline");
    expect(seen).toEqual([true, false, true]);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

// idb-keyval backed by a Map, so the queue logic runs without IndexedDB
const mem = new Map<string, unknown>();
vi.mock("idb-keyval", () => ({
  createStore: () => "store",
  get: async (k: string) => mem.get(k),
  set: async (k: string, v: unknown) => void mem.set(k, v),
  del: async (k: string) => void mem.delete(k),
  entries: async () => [...mem.entries()],
}));

const { enqueue, flush, pending } = await import("./outbox");
type Item = Parameters<typeof enqueue>[0];

const workout = (key: string, createdAt: string): Item => ({
  key,
  kind: "workout",
  createdAt,
  workout: { id: key, client_id: "c", program_day_id: null, performed_at: createdAt, duration_minutes: null, notes: null },
  sets: [],
});
const offline = new TypeError("Failed to fetch");
const isNet = (e: unknown) => e === offline;

describe("offline outbox", () => {
  beforeEach(() => mem.clear());

  it("sends oldest first and empties the queue", async () => {
    await enqueue(workout("b", "2026-09-25T10:00:00Z"));
    await enqueue(workout("a", "2026-09-25T09:00:00Z"));
    const sent: string[] = [];
    const r = await flush(async (i) => void sent.push(i.key), isNet);
    expect(sent).toEqual(["a", "b"]);
    expect(r.sent).toEqual(["a", "b"]);
    expect(await pending()).toEqual([]);
  });

  it("stops at the first network failure and keeps everything for later", async () => {
    await enqueue(workout("a", "1"));
    await enqueue(workout("b", "2"));
    const r = await flush(async () => { throw offline; }, isNet);
    expect(r.offline).toBe(true);
    expect((await pending()).map((i) => i.key)).toEqual(["a", "b"]);
  });

  it("parks an item the database refused, with the reason, and goes on", async () => {
    await enqueue(workout("a", "1"));
    await enqueue(workout("b", "2"));
    const r = await flush(async (i) => { if (i.key === "a") throw { message: "new row violates row-level security policy", code: "42501" }; }, isNet);
    expect(r).toMatchObject({ sent: ["b"], failed: ["a"], offline: false });
    const left = await pending();
    expect(left).toHaveLength(1);
    expect(left[0].error).toContain("row-level security");
    // a parked item is not retried on the next run
    const again = await flush(async () => { throw new Error("should not be called"); }, isNet);
    expect(again.sent).toEqual([]);
  });

  it("a key queued twice is one item (the same ids replay as the same rows)", async () => {
    await enqueue(workout("a", "1"));
    await enqueue(workout("a", "1"));
    expect(await pending()).toHaveLength(1);
  });
});

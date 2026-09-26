import { platform } from "../../platform";

/**
 * The client's offline outbox (docs/05 M5). Every write the client app makes directly under RLS — a finished workout
 * with its sets, a body-weight entry — goes here first and is sent from here, online or not.
 *
 * Idempotency: the rows' primary keys are made on the phone (crypto.randomUUID) and are the item's key. Replaying an item
 * inserts the same rows with ON CONFLICT (id) DO NOTHING, so a replay after a lost response never doubles a workout.
 * Items are sent oldest first; a network failure stops the run (still offline), a database refusal parks the item as
 * failed with its reason so the screen can say what happened.
 */
export type WorkoutRow = { id: string; client_id: string; program_day_id: string | null; performed_at: string; duration_minutes: number | null; notes: string | null };
export type SetRow = {
  id: string;
  workout_log_id: string;
  program_exercise_id: string | null;
  exercise_id: string;
  set_index: number;
  weight_kg: number | null;
  reps: number | null;
};
export type BodyRow = { id: string; client_id: string; measured_at: string; weight_kg: number };

export type OutboxItem =
  | { key: string; kind: "workout"; createdAt: string; workout: WorkoutRow; sets: SetRow[]; error?: string }
  | { key: string; kind: "body"; createdAt: string; row: BodyRow; error?: string };

export type Sender = (item: OutboxItem) => Promise<void>;

// IndexedDB on the web, AsyncStorage on the phone (platform.ts)
const outbox = () => platform().kv("gymos-outbox");

export async function enqueue(item: OutboxItem): Promise<void> {
  await outbox().set(item.key, item);
}

export async function pending(): Promise<OutboxItem[]> {
  const all = (await outbox().entries<OutboxItem>()).map(([, v]) => v);
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export const getItem = (key: string) => outbox().get<OutboxItem>(key);
export const removeItem = (key: string) => outbox().del(key);

export type FlushResult = { sent: string[]; failed: string[]; offline: boolean };

/** Sends every queued item, oldest first. `isNetworkError` decides between "try later" and "park as failed". */
export async function flush(send: Sender, isNetworkError: (e: unknown) => boolean): Promise<FlushResult> {
  const result: FlushResult = { sent: [], failed: [], offline: false };
  for (const item of await pending()) {
    if (item.error) continue; // parked: the screen shows it; retrying the same rows would fail the same way
    try {
      await send(item);
      await removeItem(item.key);
      result.sent.push(item.key);
    } catch (e) {
      if (isNetworkError(e)) {
        result.offline = true;
        break;
      }
      await outbox().set(item.key, { ...item, error: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e) });
      result.failed.push(item.key);
    }
  }
  return result;
}

/** Drops parked (failed) items, e.g. after the client read the reason. */
export async function discard(key: string): Promise<void> {
  await removeItem(key);
}

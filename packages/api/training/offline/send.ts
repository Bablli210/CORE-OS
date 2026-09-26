import { createClient } from "../../supabase";
import type { OutboxItem } from "./outbox";

/**
 * Sends one outbox item straight to its tables under RLS (clients own workout_logs, set_logs, body_metrics; docs/03 §7).
 * ON CONFLICT (id) DO NOTHING makes it safe to send twice: the ids came from the phone.
 */
export async function sendItem(item: OutboxItem): Promise<void> {
  const db = createClient();
  if (item.kind === "workout") {
    const w = await db.from("workout_logs").upsert(item.workout, { onConflict: "id", ignoreDuplicates: true });
    if (w.error) throw w.error;
    if (item.sets.length) {
      const s = await db.from("set_logs").upsert(item.sets, { onConflict: "id", ignoreDuplicates: true });
      if (s.error) throw s.error;
    }
  } else {
    const b = await db.from("body_metrics").upsert({ ...item.row, source: "client" }, { onConflict: "id", ignoreDuplicates: true });
    if (b.error) throw b.error;
  }
}

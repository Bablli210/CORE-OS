import type { Area } from "@/features/auth/roles";
import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Json;
  channel: string;
  read_at: string | null;
  created_at: string;
};

/** Queries under this key (sales Today, Queue) refresh whenever one of the user's notifications changes. */
export const LIVE_KEY = ["live"] as const;

export const notificationKeys = {
  all: ["notifications"] as const,
  list: () => [...notificationKeys.all, "list"] as const,
  unread: () => [...notificationKeys.all, "unread"] as const,
};

/** Latest 50 of the user's own notifications (RLS: recipient = me). */
export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await createClient()
    .from("notifications")
    .select("id, type, title, body, data, channel, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function fetchUnreadCount(): Promise<number> {
  const { count, error } = await createClient().from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  if (error) throw error;
  return count ?? 0;
}

/** Marks the given notifications read (all unread when ids is omitted). Through the RPC, never a direct update. */
export async function markRead(ids?: string[]): Promise<number> {
  const { data, error } = await createClient().rpc("fn_mark_notifications_read", ids ? { p_ids: ids } : {});
  if (error) throw error;
  return data;
}

/** Where a notification leads, from the ids in its data and the area the user is in. */
export function notificationHref(data: Json, area: Area): string | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const d = data as Record<string, Json | undefined>;
  const id = (key: string) => (typeof d[key] === "string" ? (d[key] as string) : null);
  if (id("lead_id")) return `/sales/leads/${id("lead_id")}`;
  if (id("deal_id")) return `/sales/deals/${id("deal_id")}`;
  if (id("approval_id")) return area === "coach" ? "/coach/team" : "/sales/queue";
  if (id("client_id")) {
    if (area === "coach") return `/coach/clients/${id("client_id")}`;
    if (area === "sales") return "/sales";
    if (area === "client") return "/c";
  }
  if (id("program_id") && area === "client") return "/c/workout";
  if (id("session_id") && area === "client") return "/c";
  return null;
}

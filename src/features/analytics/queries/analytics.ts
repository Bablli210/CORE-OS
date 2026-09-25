import type { Database } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/client";

type Fns = Database["public"]["Functions"];
export type Unit = "count" | "money" | "pct" | "minutes";
export type Screen = "coach" | "rep" | "sales" | "admin";
export type Tile = { key: string; value: number | null; unit: Unit; target?: number | null; sub?: Record<string, number>; live?: boolean };
export type TierMeter = { sessions: number; pct: number; tier_up_to: number | null; next_pct: number | null; tiers: { up_to: number | null; pct: number }[] };
export type Tiles = { tiles: Tile[]; meter?: TierMeter; name?: string };
export type MetricRow = { row_id: string; at: string | null; label: string | null; detail: string | null; amount: number | null; flag: boolean };
export type MetricRows = { metric: string; month: string; count: number; total: number | null; rows: MetricRow[] };
export type TargetRow = { scope_type: "branch" | "membership"; scope_id: string; name: string; role: string | null; branch_id: string; metric: "won_revenue" | "new_clients" | "sessions_completed"; unit: Unit; target: number | null; actual: number | null };
export type CoachWeek = Fns["fn_dashboard_coach_weeks"]["Returns"][number];
export type Weekly = Fns["fn_dashboard_weekly"]["Returns"][number];
export type RepExtra = Fns["fn_dashboard_rep_extra"]["Returns"][number];
export type SourceRoi = Fns["fn_dashboard_sources"]["Returns"][number];
export type TodayLive = { visits: number; sessions_completed: number; sessions_booked_today: number; unpaid_sessions_open: number; leads: number; collected: number };
export type AuditRow = { id: number; occurred_at: string; kind: string; action: string | null; row_id: string | null; branch_id: string | null; actor: string | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null };
export type Audit = { tables: string[]; rows: AuditRow[] };

export const analyticsKeys = {
  all: ["analytics"] as const,
  tiles: (screen: Screen, month: string, scope: string | null) => ["analytics", "tiles", screen, month, scope ?? ""] as const,
  rows: (metric: string, month: string, scope: string | null, extra: string) => ["analytics", "rows", metric, month, scope ?? "", extra] as const,
  targets: (period: string, all: boolean) => ["analytics", "targets", period, all] as const,
  coachWeeks: (branch: string | null) => ["analytics", "coach-weeks", branch ?? ""] as const,
  weekly: ["analytics", "weekly"] as const,
  repExtra: (month: string) => ["analytics", "rep-extra", month] as const,
  sources: (month: string) => ["analytics", "sources", month] as const,
  today: ["analytics", "today"] as const,
  audit: (filters: string) => ["analytics", "audit", filters] as const,
};

const db = () => createClient();
function unwrap<T>({ data, error }: { data: unknown; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const fetchTiles = async (screen: Screen, month: string, scope: string | null): Promise<Tiles> =>
  unwrap(await db().rpc("fn_dashboard_tiles", { p_screen: screen, p_month: month, p_scope: scope ?? undefined }));
export const fetchRows = async (metric: string, month: string, scope: string | null, extra: Record<string, number>): Promise<MetricRows> =>
  unwrap(await db().rpc("fn_dashboard_rows", { p_metric: metric, p_month: month, p_scope: scope ?? undefined, p_extra: extra }));
export const fetchTargets = async (period: string, all = false): Promise<TargetRow[]> => unwrap(await db().rpc("fn_dashboard_targets", { p_period: period, p_all: all }));
export const saveTarget = async (t: Pick<TargetRow, "scope_type" | "scope_id" | "metric">, period: string, value: number | null) =>
  unwrap(await db().rpc("fn_save_target", { p_period: period, p_scope_type: t.scope_type, p_scope_id: t.scope_id, p_metric: t.metric, p_value: value as number }));
export const fetchCoachWeeks = async (branch: string | null): Promise<CoachWeek[]> => unwrap(await db().rpc("fn_dashboard_coach_weeks", branch ? { p_branch: branch } : {}));
export const fetchWeekly = async (): Promise<Weekly[]> => unwrap(await db().rpc("fn_dashboard_weekly", { p_weeks: 12 }));
export const fetchRepExtra = async (month: string): Promise<RepExtra[]> => unwrap(await db().rpc("fn_dashboard_rep_extra", { p_month: month }));
export const fetchSources = async (month: string): Promise<SourceRoi[]> => unwrap(await db().rpc("fn_dashboard_sources", { p_month: month }));
export const fetchToday = async (): Promise<TodayLive> => unwrap(await db().rpc("fn_today_live"));
export const fetchAudit = async (f: { source: "events" | "audit"; table?: string; from?: string; to?: string; search?: string }): Promise<Audit> =>
  unwrap(await db().rpc("fn_audit_explorer", { p_source: f.source, p_table: f.table || undefined, p_from: f.from || undefined, p_to: f.to || undefined, p_search: f.search || undefined, p_limit: 200 }));

/** Where a tile clicks through to: the rows behind it, with the same month and scope. */
export function rowsHref(metric: string, month: string, scope: string | null, extra?: Record<string, number>): string {
  const q = new URLSearchParams({ metric, month });
  if (scope) q.set("scope", scope);
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, String(v));
  return `/numbers/rows?${q}`;
}

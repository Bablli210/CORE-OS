import type { Database } from "../database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];

/** The four app areas. Each role lands in exactly one (docs/05 M1 routing). */
export type Area = "client" | "coach" | "sales" | "admin";

export type MembershipContext = {
  id: string;
  role: AppRole;
  branchId: string | null;
  branchName: string | null;
};

export const AREA_BY_ROLE: Record<AppRole, Area> = {
  client: "client",
  coach: "coach",
  head_coach: "coach",
  nutritionist: "coach",
  sales_rep: "sales",
  sales_manager: "sales",
  front_desk: "sales",
  top_management: "admin",
};

export const AREA_HOME: Record<Area, string> = {
  client: "/c",
  coach: "/coach",
  sales: "/sales",
  admin: "/admin",
};

/** Default context when nothing is remembered: the broadest role first (head coach before coach, so Team shows). */
export const ROLE_PRIORITY: AppRole[] = [
  "top_management",
  "sales_manager",
  "head_coach",
  "sales_rep",
  "coach",
  "nutritionist",
  "front_desk",
  "client",
];

/** Cookie holding the last used membership id ("the last used role is remembered", docs/04). */
export const CONTEXT_COOKIE = "gymos_ctx";

export function areaForRole(role: AppRole): Area {
  return AREA_BY_ROLE[role];
}

export function homeFor(context: Pick<MembershipContext, "role">): string {
  return AREA_HOME[areaForRole(context.role)];
}

export function areaForPath(pathname: string): Area | null {
  if (pathname === "/c" || pathname.startsWith("/c/")) return "client";
  if (pathname === "/coach" || pathname.startsWith("/coach/")) return "coach";
  if (pathname === "/sales" || pathname.startsWith("/sales/")) return "sales";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return "admin";
  return null;
}

function byPriority(a: MembershipContext, b: MembershipContext) {
  return ROLE_PRIORITY.indexOf(a.role) - ROLE_PRIORITY.indexOf(b.role) || (a.branchName ?? "").localeCompare(b.branchName ?? "");
}

/**
 * Picks the membership the user is acting as. Within an area (when given), the remembered membership wins if it
 * belongs there; otherwise the highest-priority role. Returns null when the user has no membership in that area.
 */
export function resolveContext<T extends MembershipContext>(memberships: T[], area?: Area | null, preferredId?: string | null): T | null {
  const candidates = area ? memberships.filter((m) => areaForRole(m.role) === area) : memberships;
  if (candidates.length === 0) return null;
  const preferred = preferredId ? candidates.find((m) => m.id === preferredId) : undefined;
  return preferred ?? [...candidates].sort(byPriority)[0];
}

/** The memberships offered in the role switcher (every active one, in priority order). */
export function switcherOptions<T extends MembershipContext>(memberships: T[]): T[] {
  return [...memberships].sort(byPriority);
}

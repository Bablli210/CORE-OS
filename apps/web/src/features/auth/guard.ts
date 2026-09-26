import { redirect } from "next/navigation";
import { getMe, getSession, preferredMembershipId, type Me } from "./me";
import { AREA_HOME, homeFor, resolveContext, type AppRole, type Area } from "./roles";

/**
 * For layouts/pages of an area: returns the session acting in that area, or redirects —
 * to /login without a session, to the user's own home when they have no role in this area.
 */
export async function requireArea(area: Area): Promise<Me> {
  const me = await getMe(area);
  if (me) return me;
  const session = await getSession();
  if (!session) redirect("/login");
  const fallback = resolveContext(session.memberships, null, await preferredMembershipId());
  redirect(fallback ? homeFor(fallback) : "/no-access");
}

/**
 * For pages limited to some roles of an area (head coach Team, sales manager Queue). If the user holds such a role
 * in the area but is acting as another, switch to it (same branch first); otherwise go to the area home.
 */
export async function requireRole(area: Area, roles: AppRole[], path: string): Promise<Me> {
  const me = await requireArea(area);
  if (roles.includes(me.active.role)) return me;
  const match =
    me.memberships.find((m) => roles.includes(m.role) && m.branchId === me.active.branchId) ??
    me.memberships.find((m) => roles.includes(m.role));
  if (match) redirect(`/context/${match.id}?next=${encodeURIComponent(path)}`);
  redirect(AREA_HOME[area]);
}

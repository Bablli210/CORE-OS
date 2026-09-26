import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { areaForRole, CONTEXT_COOKIE, resolveContext, type Area } from "@gymos/api/auth/roles";
import { loadSession, type Me } from "@gymos/api/auth/session";

export type { Branch, Membership, Profile, Me } from "@gymos/api/auth/session";

/** Signed-in person with their active memberships, or null (no session, or deactivated). Cached per request. */
export const getSession = cache(async () => loadSession(await createClient()));

export async function preferredMembershipId(): Promise<string | null> {
  return (await cookies()).get(CONTEXT_COOKIE)?.value ?? null;
}

/** The session resolved for an area (or the user's default context when area is omitted). */
export async function getMe(area?: Area): Promise<Me | null> {
  const session = await getSession();
  if (!session) return null;
  const active = resolveContext(session.memberships, area, await preferredMembershipId());
  if (!active) return null;
  const branchIds = active.role === "top_management" ? session.branches.map((b) => b.id) : active.branchId ? [active.branchId] : [];
  return { ...session, active, area: area ?? areaForRole(active.role), branchIds };
}


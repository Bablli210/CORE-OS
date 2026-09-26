import type { Db } from "../supabase";
import type { AppRole, Area, MembershipContext } from "./roles";

export type Branch = { id: string; code: string; name: string };

export type Membership = MembershipContext & {
  branchCode: string | null;
  capacity: number | null;
  discountAllowancePct: number;
};

export type Profile = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  preferredLanguage: "en" | "ar";
};

/** Everything the app needs about the signed-in person. Serialisable, so it is passed to useMe() as-is. */
export type Me = {
  profile: Profile;
  memberships: Membership[];
  branches: Branch[];
  /** The membership being acted as (role + branch). */
  active: Membership;
  area: Area;
  /** Branches in scope for the active context: its branch, or every branch for top management. */
  branchIds: string[];
};

export type Session = { profile: Profile; memberships: Membership[]; branches: Branch[] };

/**
 * Signed-in person with their active memberships, or null (no session, or deactivated). The web calls it with its
 * server client (cookies), the phone with its own client; same three reads under RLS.
 */
export async function loadSession(supabase: Db): Promise<Session | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [profileRes, membershipsRes, branchesRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, phone, preferred_language, is_active").eq("id", user.id).maybeSingle(),
    supabase
      .from("memberships")
      .select("id, role, branch_id, capacity, discount_allowance_pct")
      .eq("profile_id", user.id)
      .eq("is_active", true),
    supabase.from("branches").select("id, code, name").eq("is_active", true).order("code"),
  ]);
  const p = profileRes.data;
  if (!p || !p.is_active) return null;

  const branches: Branch[] = branchesRes.data ?? [];
  const branchById = new Map(branches.map((b) => [b.id, b]));
  const memberships: Membership[] = (membershipsRes.data ?? []).map((m) => ({
    id: m.id,
    role: m.role as AppRole,
    branchId: m.branch_id,
    branchName: m.branch_id ? (branchById.get(m.branch_id)?.name ?? null) : null,
    branchCode: m.branch_id ? (branchById.get(m.branch_id)?.code ?? null) : null,
    capacity: m.capacity,
    discountAllowancePct: Number(m.discount_allowance_pct),
  }));

  return {
    profile: {
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      phone: p.phone,
      preferredLanguage: p.preferred_language === "ar" ? "ar" : "en",
    },
    memberships,
    branches,
  };
}


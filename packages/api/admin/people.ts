import type { PostgrestError } from "@supabase/supabase-js";
import type { AppRole } from "../auth/roles";
import type { MessageKey } from "@gymos/i18n";
import { createClient } from "../supabase";
import type { MembershipInput } from "./people-schema";

export type PersonMembership = {
  id: string;
  role: AppRole;
  branchId: string | null;
  isActive: boolean;
  capacity: number | null;
  specialties: string[];
  discountAllowancePct: number;
};

export type Person = { id: string; fullName: string; email: string | null; phone: string | null; isActive: boolean; memberships: PersonMembership[] };

export const peopleKeys = { all: ["people"] as const };

/** Staff (anyone with an email or a non-client role). RLS: top management sees everyone. */
export async function fetchPeople(): Promise<Person[]> {
  const { data, error } = await createClient()
    .from("profiles")
    .select("id, full_name, email, phone, is_active, memberships(id, role, branch_id, is_active, capacity, specialties, discount_allowance_pct)")
    .order("full_name");
  if (error) throw error;
  return data
    .map((p) => ({
      id: p.id,
      fullName: p.full_name,
      email: p.email,
      phone: p.phone,
      isActive: p.is_active,
      memberships: p.memberships.map((m) => ({
        id: m.id,
        role: m.role,
        branchId: m.branch_id,
        isActive: m.is_active,
        capacity: m.capacity,
        specialties: m.specialties,
        discountAllowancePct: Number(m.discount_allowance_pct),
      })),
    }))
    .filter((p) => p.email !== null || p.memberships.some((m) => m.role !== "client"));
}

export async function saveMembership(profileId: string, membershipId: string | null, input: MembershipInput): Promise<string> {
  const { data, error } = await createClient().rpc("fn_save_membership", {
    p_membership_id: membershipId as string,
    p_profile_id: profileId,
    p_role: input.role,
    p_branch_id: input.branchId as string,
    p_capacity: input.capacity as number,
    p_specialties: input.specialties,
    p_discount_allowance_pct: input.discountAllowancePct,
    p_is_active: input.isActive,
  });
  if (error) throw error;
  return data;
}

export async function setPersonActive(profileId: string, active: boolean): Promise<void> {
  const { error } = await createClient().rpc("fn_set_profile_active", { p_profile_id: profileId, p_active: active });
  if (error) throw error;
}

/** Maps a database error to something the admin can act on. */
export function peopleErrorKey(error: unknown): MessageKey {
  const code = (error as PostgrestError | null)?.code;
  if (code === "23505") return "people.error.duplicateRole";
  if (code === "42501") return "error.notAllowed";
  if (code === "23514") return "people.error.invalid";
  return "error.generic";
}

"use server";

import type { MessageKey } from "@/lib/i18n";
import { publicEnv } from "@/lib/env";
import { createAdminAuthClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { inviteSchema, type InviteInput } from "./schemas/people";

export type InviteResult = { error?: MessageKey; profileId?: string };

/**
 * Invites a staff member: auth user + invite email (admin API), then profile and first role through the caller's
 * own session (fn_create_staff_profile, fn_save_membership — RLS and top-management checks apply there too).
 */
export async function inviteStaff(input: InviteInput): Promise<InviteResult> {
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { error: "people.error.invalid" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: isTop, error: roleError } = await supabase.rpc("is_top_management");
  if (roleError || !isTop) return { error: "error.notAllowed" };

  const admin = createAdminAuthClient();
  const { data, error } = await admin.inviteUserByEmail(v.email.toLowerCase(), {
    redirectTo: `${publicEnv.appUrl}/welcome`,
    data: { full_name: v.fullName },
  });
  if (error || !data.user) return { error: error?.code === "email_exists" ? "people.error.emailExists" : "people.error.inviteFailed" };
  const userId = data.user.id;

  const profile = await supabase.rpc("fn_create_staff_profile", {
    p_profile_id: userId,
    p_full_name: v.fullName,
    p_email: v.email,
    p_phone: (v.phone || null) as string,
  });
  const membership = profile.error
    ? null
    : await supabase.rpc("fn_save_membership", {
        p_membership_id: null as unknown as string,
        p_profile_id: userId,
        p_role: v.role,
        p_branch_id: v.branchId as string,
      });
  if (profile.error || membership?.error) {
    // Nothing references the new auth user yet; remove it so the invite can be retried cleanly.
    await admin.deleteUser(userId);
    return { error: profile.error?.code === "23505" ? "people.error.phoneTaken" : "people.error.inviteFailed" };
  }
  return { profileId: userId };
}

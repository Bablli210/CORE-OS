import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type CoachBalance = { coachMembershipId: string; coachName: string; balance: number; nextExpiry: string | null };
export type ClientCredits = { clientId: string; balances: CoachBalance[]; membershipEndsAt: string | null };

/** The signed-in client's sessions left per coach (fn_credit_balances) and active membership end. RLS-scoped. */
export async function fetchMyCredits(supabase: ServerClient): Promise<ClientCredits | null> {
  const { data: clientId, error } = await supabase.rpc("my_client_id");
  if (error) throw error;
  if (!clientId) return null;
  const [balances, entitlement] = await Promise.all([
    supabase.rpc("fn_credit_balances", { p_client_id: clientId }),
    supabase
      .from("entitlements")
      .select("ends_at")
      .eq("client_id", clientId)
      .eq("type", "membership")
      .eq("status", "active")
      .order("ends_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (balances.error) throw balances.error;
  if (entitlement.error) throw entitlement.error;
  return {
    clientId,
    balances: balances.data.map((b) => ({ coachMembershipId: b.coach_membership_id, coachName: b.coach_name, balance: b.balance, nextExpiry: b.next_expiry })),
    membershipEndsAt: entitlement.data?.ends_at ?? null,
  };
}

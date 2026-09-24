import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { requireArea } from "@/features/auth/guard";
import { CreditSummary } from "@/features/credits/components/credit-summary";
import { fetchMyCredits, type ClientCredits } from "@/features/credits/queries/client-credits";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("nav.today") };

/** Client Today (M1 scope: name + sessions left per coach; next session and workout arrive in M5). */
export default async function ClientToday() {
  const me = await requireArea("client");
  let credits: ClientCredits | null = null;
  let failed = false;
  try {
    credits = await fetchMyCredits(await createClient());
  } catch {
    failed = true;
  }
  return (
    <div className="grid max-w-xl gap-4">
      <PageHeader title={t("client.greeting", { name: me.profile.fullName.split(" ")[0] })} description={me.profile.fullName} />
      {failed ? (
        <ErrorState title={t("credits.error")} body={t("error.reloadHint")} />
      ) : credits ? (
        <CreditSummary credits={credits} />
      ) : (
        <ErrorState title={t("client.notLinked")} body={t("client.notLinkedBody")} />
      )}
      <EmptyState icon={CalendarDays} title={t("client.noSession")} body={t("placeholder.comingIn", { milestone: "M5" })} action={{ href: "/c/credits", label: t("nav.credits") }} />
    </div>
  );
}

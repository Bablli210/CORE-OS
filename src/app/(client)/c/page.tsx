import type { Metadata } from "next";
import { CalendarDays, Dumbbell } from "lucide-react";
import { EmptyState, ErrorState, PageHeader } from "@/components/states";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireArea } from "@/features/auth/guard";
import { CreditSummary } from "@/features/credits/components/credit-summary";
import { fetchMyCredits, type ClientCredits } from "@/features/credits/queries/client-credits";
import { ProgramPreview } from "@/features/programs/components/program-preview";
import { fetchMyActiveProgram } from "@/features/programs/queries/my-program";
import type { Program } from "@/features/programs/queries/programs";
import { formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("nav.today") };

/** Client Today: sessions left per coach, membership end, and the active program (M4). Next session and logging arrive in M5. */
export default async function ClientToday() {
  const me = await requireArea("client");
  const supabase = await createClient();
  let credits: ClientCredits | null = null;
  let program: Program | null = null;
  let failed = false;
  try {
    [credits, program] = await Promise.all([fetchMyCredits(supabase), fetchMyActiveProgram(supabase)]);
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
      {program ? (
        <Card data-testid="my-program">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Dumbbell aria-hidden className="size-4" />{program.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {t("myProgram.line", { coach: program.coach_name ?? "", weeks: program.weeks })}
              {program.ends_at ? ` · ${t("myProgram.until", { date: formatDate(program.ends_at) })}` : ""}
            </p>
          </CardHeader>
          <CardContent><ProgramPreview days={program.days} /></CardContent>
        </Card>
      ) : !failed && credits ? (
        <EmptyState icon={Dumbbell} title={t("myProgram.none")} body={t("myProgram.noneBody")} action={{ href: "/c/credits", label: t("nav.credits") }} />
      ) : null}
      <EmptyState icon={CalendarDays} title={t("client.noSession")} body={t("placeholder.comingIn", { milestone: "M5" })} action={{ href: "/c/credits", label: t("nav.credits") }} />
    </div>
  );
}

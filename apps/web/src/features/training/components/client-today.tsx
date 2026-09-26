"use client";

import { GettingStarted } from "@/features/guide/components/getting-started";
import { CalendarDays, CheckCircle2, CloudOff, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditSummary } from "@/features/credits/components/credit-summary";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { formatDate, formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { useHome } from "@gymos/api/training/use-client";
import { checkIn, type CheckInResult } from "@gymos/api/training/client";

/**
 * /c — the member's Today (docs/04): next session and "I'm here", today's workout, sessions left per coach, and the weekly
 * slots their coach set for them (read-only: members don't book). Opens from the phone's last copy without signal.
 */
export function ClientToday() {
  const home = useHome();
  const [here, setHere] = useState<CheckInResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (home.isPending) return <LoadingList label={t("common.loading")} />;
  if (home.isError || !home.data) return <ErrorState title={t("client.notLinked")} body={t("client.notLinkedBody")} action={<Button variant="outline" onClick={() => home.refetch()}>{t("common.retry")}</Button>} />;
  const h = home.data;
  const next = h.next_session;
  const day = h.program?.days.find((d) => d.day_index === h.program?.next_day_index);
  const checkedIn = h.checked_in_today || here?.ok;

  return (
    <div className="grid max-w-xl gap-4">
      <PageHeader title={t("client.greeting", { name: h.first_name })} description={t("home.job")} />
      {h.fromCache ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><CloudOff aria-hidden className="size-4" />{t("home.cached")}</p> : null}

      <Card data-testid="next-session">
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays aria-hidden className="size-4" />{t("home.next")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {next ? <p>{t("home.nextLine", { when: formatDateTime(next.starts_at), coach: next.coach_name, branch: next.branch_name })}</p> : <p className="text-sm text-muted-foreground">{t("home.noSession")}</p>}
          {checkedIn ? (
            <p role="status" className="flex items-center gap-2 font-medium text-success"><CheckCircle2 aria-hidden className="size-5" />{here?.duplicate || h.checked_in_today ? t("home.alreadyIn") : t("home.checkedIn", { branch: here?.branch_name ?? "" })}</p>
          ) : next?.within_hour ? (
            <Button size="block" disabled={busy} onClick={async () => {
              setBusy(true); setError(null);
              try { const r = await checkIn(); setHere(r); if (!r.ok) setError({ message: r.reason }); } catch (e) { setError(e); } finally { setBusy(false); }
            }}>{t("home.imHere")}</Button>
          ) : <p className="text-sm text-muted-foreground">{t("home.scanHint")}</p>}
          {error ? <p role="alert" className="text-sm text-destructive">{here?.reason ? t(`home.reason.${here.reason}` as MessageKey) : t(coachingErrorKey(error))}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Dumbbell aria-hidden className="size-4" />{t("home.workout")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {h.program && day ? (
            <>
              <p>{t("home.workoutLine", { day: day.name, n: day.exercises })}</p>
              <Link href={`/c/workout?day=${day.day_index}`} className={cn(buttonVariants(), "w-full")}>{t("home.startWorkout")}</Link>
              <p className="text-xs text-muted-foreground">{t("home.thisWeek", { n: h.workouts_this_week })}</p>
            </>
          ) : <p className="text-sm text-muted-foreground">{t("myProgram.noneBody")}</p>}
        </CardContent>
      </Card>

      <div className="empty:hidden"><GettingStarted /></div>

      <CreditSummary credits={{ clientId: h.client_id, membershipEndsAt: h.membership_ends_at, balances: h.balances.map((b) => ({ coachMembershipId: b.coach_membership_id, coachName: b.coach_name, balance: b.balance, nextExpiry: b.next_expiry })) }} />

      <Card data-testid="my-slots">
        <CardHeader><CardTitle>{t("home.yourWeek")}</CardTitle><p className="text-sm text-muted-foreground">{t("home.yourWeekHint")}</p></CardHeader>
        <CardContent>
          {h.slots.length === 0 ? <p className="text-sm text-muted-foreground">{t("home.noSlots")}</p> : (
            <ul className="grid gap-2 text-sm">
              {h.slots.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
                  <span className="font-medium">{t(`weekday.${s.weekday}` as MessageKey)}</span>
                  <span className="tabular-nums">{s.start_time}</span>
                  <span className="min-w-0 truncate text-muted-foreground">{s.coach_name}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {h.program ? (
        <Card data-testid="my-program">
          <CardHeader>
            <CardTitle>{h.program.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{t("myProgram.line", { coach: h.program.coach_name ?? "", weeks: h.program.weeks })}{h.program.ends_at ? ` · ${t("myProgram.until", { date: formatDate(h.program.ends_at) })}` : ""}</p>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1 text-sm">{h.program.days.map((d) => <li key={d.day_index}>{t("home.programDay", { name: d.name, n: d.exercises })}</li>)}</ul>
          </CardContent>
        </Card>
      ) : <EmptyState icon={Dumbbell} title={t("myProgram.none")} body={t("myProgram.noneBody")} action={{ href: "/c/credits", label: t("nav.credits") }} />}
    </div>
  );
}

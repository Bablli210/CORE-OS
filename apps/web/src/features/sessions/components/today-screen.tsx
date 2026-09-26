"use client";

import { GettingStarted } from "@/features/guide/components/getting-started";
import { CalendarDays, ChevronLeft, ChevronRight, CloudOff, UserPlus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Section } from "@/components/layout";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate, shortDuration } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useCoachMutation, useDay, useOwnCoachMembership } from "../hooks/use-coach";
import { useOutcomes } from "@gymos/api/sessions/use-outcomes";
import { withQueued } from "@gymos/api/sessions/outcome-queue";
import { completeFollowUp, type DaySession, type Outcome } from "@gymos/api/sessions/coach";
import { addDays, cairoToday, isIsoDate } from "@gymos/api/sessions/week";
import { DayTimeline } from "./day-timeline";
import { UnpaidConfirmSheet, WalkInSheet } from "./walkin-sheet";

/** /coach — run the day from one screen (docs/04). ?date= shows another day; ?coach= is the head coach looking at a coach. */
export function TodayScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const own = useOwnCoachMembership();
  const coach = params.get("coach") ?? own;
  const today = cairoToday();
  const date = isIsoDate(params.get("date")) ? params.get("date")! : today;
  const day = useDay(coach, date);
  const { record, queue, message, retryNow } = useOutcomes(coach, date);
  const [confirm, setConfirm] = useState<DaySession | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [status, setStatus] = useState("");
  const done = useCoachMutation((id: string) => completeFollowUp(id));

  const go = (d: string) => {
    const next = new URLSearchParams(params);
    if (d === today) next.delete("date");
    else next.set("date", d);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  if (!coach) {
    return (
      <>
        <PageHeader title={t("today.title")} />
        <EmptyState title={t("schedule.noCoach")} body={t("schedule.noCoachBody")} action={{ href: "/notifications", label: t("today.openNotifications") }} />
      </>
    );
  }

  const shown = day.data ? withQueued(day.data, queue) : null;
  const queuedIds = new Set(queue.filter((q) => q.coach === coach).map((q) => q.sessionId));
  const recordable = !!shown?.can_record && date <= today;
  const onOutcome = (s: DaySession, o: Outcome) => {
    if (o === "completed" && s.credits_left <= 0 && !s.credit_consumed && !s.unpaid) setConfirm(s);
    else void record(s.id, o);
  };

  return (
    <>
      <PageHeader
        title={date === today ? t("today.title") : formatDate(`${date}T12:00:00Z`)}
        description={t("today.job")}
        meta={shown && shown.sessions.length ? <RecordedProgress total={shown.sessions.length} done={shown.sessions.filter((s) => s.status !== "booked").length} /> : undefined}
        actions={<Link href="/coach/schedule" className={buttonVariants({ variant: "outline" })}><CalendarDays aria-hidden />{t("action.openWeek")}</Link>}
      />
      <div className="mb-4 flex items-center gap-1">
        <Button variant="outline" size="icon" aria-label={t("today.prevDay")} onClick={() => go(addDays(date, -1))}><ChevronLeft className="rtl:rotate-180" /></Button>
        <span className="min-w-36 px-2 text-center text-sm font-medium">{formatDate(`${date}T12:00:00Z`)}</span>
        <Button variant="outline" size="icon" aria-label={t("today.nextDay")} onClick={() => go(addDays(date, 1))}><ChevronRight className="rtl:rotate-180" /></Button>
        {date !== today ? <Button variant="link" onClick={() => go(today)}>{t("today.backToToday")}</Button> : null}
      </div>

      {queue.length ? (
        <div role="status" data-testid="queue-banner" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          <span className="flex items-center gap-2"><CloudOff aria-hidden className="size-4" />{t("today.queueBanner", { n: queue.length })}</span>
          <Button size="sm" variant="outline" onClick={() => void retryNow()}>{t("common.retry")}</Button>
        </div>
      ) : null}
      {message ? <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "mb-3 text-sm text-destructive" : "mb-3 text-sm text-info"}>{message.text}</p> : null}
      <p role="status" className="min-h-5 text-sm text-success">{status}</p>

      {day.isPending ? (
        <LoadingList label={t("common.loading")} />
      ) : day.isError || !shown ? (
        <ErrorState title={t("today.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => day.refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
          <section aria-label={t("today.day")} className="grid content-start gap-3">
            {shown.sessions.length === 0 && shown.blocks.length === 0 ? (
              <EmptyState title={t("today.empty")} body={t("today.emptyBody")} action={{ href: "/coach/schedule", label: t("action.openWeek") }} />
            ) : (
              <DayTimeline day={shown} canRecord={recordable} queuedIds={queuedIds} onOutcome={onOutcome} />
            )}
            {date > today && shown.can_record ? <p className="text-sm text-muted-foreground">{t("today.futureHint")}</p> : null}
          </section>
          <aside className="grid content-start gap-6">
            {recordable && date === today ? (
              <Button size="block" variant="outline" onClick={() => setWalkIn(true)}><UserPlus aria-hidden />{t("today.walkInStart")}</Button>
            ) : null}
            <Section title={t("today.followUps")} count={shown.follow_ups.length} plain>
              {shown.follow_ups.length === 0 ? (
                <p className="rounded-lg border bg-card p-3 text-sm text-muted-foreground">{t("today.noFollowUps")}</p>
              ) : (
                <ul className="grid gap-2">
                  {shown.follow_ups.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm">
                      <span className="grid">
                        {f.client_id ? <Link href={`/coach/clients/${f.client_id}`} className="font-medium hover:underline">{f.title}</Link> : <span className="font-medium">{f.title}</span>}
                        <span className={f.overdue ? "text-destructive" : "text-muted-foreground"}>{f.overdue ? t("today.overdue", { time: shortDuration(Date.now() - new Date(f.due_at).getTime()) }) : t("today.due", { date: formatDate(f.due_at) })}</span>
                      </span>
                      <Button size="sm" variant="outline" disabled={done.isPending} onClick={() => done.mutate(f.id)}>{t("today.done")}</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
            {date === today ? <div className="empty:hidden"><GettingStarted /></div> : null}
          </aside>
        </div>
      )}

      {confirm ? (
        <UnpaidConfirmSheet
          name={confirm.client_name}
          onClose={() => setConfirm(null)}
          onConfirm={() => {
            void record(confirm.id, "completed");
            setStatus(t("today.flagged", { name: confirm.client_name }));
            setConfirm(null);
          }}
        />
      ) : null}
      {walkIn ? <WalkInSheet coach={coach} onClose={() => setWalkIn(false)} onDone={(name) => { setWalkIn(false); setStatus(t("today.walkInDone", { name })); }} /> : null}
    </>
  );
}

/** "2 of 4 recorded" with a bar, so the coach sees at a glance what is left to record today. */
function RecordedProgress({ total, done }: { total: number; done: number }) {
  return (
    <span className="flex w-full max-w-xs items-center gap-3 text-sm" data-testid="recorded-progress">
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-success" style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="whitespace-nowrap text-muted-foreground">{t("today.recorded", { done, n: total })}</span>
    </span>
  );
}

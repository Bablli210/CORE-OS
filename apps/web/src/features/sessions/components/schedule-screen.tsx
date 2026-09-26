"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { useIsDesktop, useOwnCoachMembership, useSchedulable, useWeek } from "../hooks/use-coach";
import type { Slot } from "@gymos/api/sessions/coach";
import { formatDate } from "@gymos/api/format";
import { addDays, cairoToday, dateInWeek, isIsoDate, WEEK_ORDER, weekdayOf, weekStart } from "@gymos/api/sessions/week";
import { HoursSheet } from "./hours-sheet";
import { SlotDetailSheet } from "./slot-detail-sheet";
import { SlotSheet } from "./slot-sheet";
import { WeekGrid } from "./week-grid";

/**
 * /coach/schedule — the coach's recurring week (docs/04). URL: ?coach= (head coach viewing another coach), ?week= (its Saturday),
 * ?day= (the day shown on a phone), ?client= (preselected from the client's page: "Add to my week").
 */
export function ScheduleScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const own = useOwnCoachMembership();
  const coach = params.get("coach") ?? own;
  const today = cairoToday();
  const start = weekStart(isIsoDate(params.get("week")) ? params.get("week")! : today);
  const day = Number(params.get("day") ?? weekdayOf(today));
  const presetClient = params.get("client");
  const desktop = useIsDesktop();
  const week = useWeek(coach, start);
  const clients = useSchedulable(coach);
  const [cell, setCell] = useState<{ weekday: number; hour: number } | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [message, setMessage] = useState("");

  const go = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  if (!coach) {
    return (
      <>
        <PageHeader title={t("schedule.title")} />
        <EmptyState title={t("schedule.noCoach")} body={t("schedule.noCoachBody")} action={{ href: "/coach", label: t("nav.backToday") }} />
      </>
    );
  }
  const w = week.data;
  const viewingOther = !!params.get("coach") && params.get("coach") !== own;

  return (
    <>
      <PageHeader
        title={viewingOther && w ? t("schedule.titleOf", { coach: w.coach.name }) : t("schedule.title")}
        description={t("schedule.description")}
        actions={
          w?.can_edit ? (
            <Button variant="outline" onClick={() => setHoursOpen(true)}>
              <Clock aria-hidden /> {t("hours.title")}
            </Button>
          ) : null
        }
      />
      {viewingOther ? (
        <p className="mb-3 text-sm">
          <Link href="/coach/team" className="underline underline-offset-4">{t("schedule.backTeam")}</Link>
        </p>
      ) : null}
      {presetClient && clients.data ? (
        <p className="mb-3 rounded-md border border-info/40 bg-info/10 p-3 text-sm" data-testid="preset-client">
          {t("schedule.presetHint", { name: clients.data.find((c) => c.client_id === presetClient)?.full_name ?? "" })}
        </p>
      ) : null}

      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label={t("schedule.prevWeek")} onClick={() => go({ week: addDays(start, -7) })}><ChevronLeft className="rtl:rotate-180" /></Button>
        <div className="grid text-center">
          <span className="font-medium" data-testid="week-range">{t("schedule.weekOf", { from: formatDate(start), to: formatDate(addDays(start, 6)) })}</span>
          {start !== weekStart(today) ? <button type="button" className="text-sm underline underline-offset-4" onClick={() => go({ week: null })}>{t("schedule.thisWeek")}</button> : null}
        </div>
        <Button variant="ghost" size="icon" aria-label={t("schedule.nextWeek")} onClick={() => go({ week: addDays(start, 7) })}><ChevronRight className="rtl:rotate-180" /></Button>
      </div>

      {!desktop ? (
        <div role="tablist" aria-label={t("schedule.dayTabs")} className="mb-3 grid grid-cols-7 gap-1">
          {WEEK_ORDER.map((d) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={d === day}
              aria-label={t(`weekday.${d}` as MessageKey)}
              onClick={() => go({ day: String(d) })}
              className={cn("grid min-h-tap place-items-center rounded-md text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", d === day ? "bg-primary text-primary-foreground" : "bg-muted")}
            >
              <span>{t(`weekday.short.${d}` as MessageKey)}</span>
              <span className="text-[0.7rem] opacity-80">{dateInWeek(start, d).slice(8)}</span>
            </button>
          ))}
        </div>
      ) : null}

      <p role="status" className="mb-2 min-h-5 text-sm text-success">{message}</p>

      {week.isPending ? (
        <LoadingList label={t("common.loading")} rows={6} />
      ) : week.isError || !w ? (
        <ErrorState title={t("schedule.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => week.refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <>
          {w.slots.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">{t("schedule.empty")}</p> : null}
          <WeekGrid week={w} days={desktop ? [...WEEK_ORDER] : [day]} onFreeCell={(weekday, hour) => setCell({ weekday, hour })} onSlot={setSlot} />
          <p className="mt-2 text-xs text-muted-foreground">{t("schedule.legend")}</p>
        </>
      )}

      {cell && w ? (
        <SlotSheet
          coach={coach}
          weekday={cell.weekday}
          hour={cell.hour}
          startsOn={start > today ? start : today}
          slotMinutes={w.slot_minutes}
          clients={clients.data ?? []}
          presetClientId={presetClient}
          onClose={() => setCell(null)}
          onDone={(n) => { setCell(null); setMessage(t("schedule.added", { n })); }}
        />
      ) : null}
      {slot && w ? (
        <SlotDetailSheet
          coach={coach}
          slot={slot}
          date={dateInWeek(start, slot.weekday)}
          today={today}
          canEdit={w.can_edit}
          onClose={() => setSlot(null)}
          onDone={(m) => { setSlot(null); setMessage(m); }}
        />
      ) : null}
      {hoursOpen && w ? <HoursSheet coach={coach} hours={w.availability} onClose={() => setHoursOpen(false)} onDone={() => { setHoursOpen(false); setMessage(t("hours.saved")); }} /> : null}
    </>
  );
}

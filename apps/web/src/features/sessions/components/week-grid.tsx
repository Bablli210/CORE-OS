"use client";

import { Plus } from "lucide-react";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import type { CoachWeek, Slot } from "@gymos/api/sessions/coach";
import { cellStart, dateInWeek, fromMinutes, gridHours, laneLayout, toMinutes } from "@gymos/api/sessions/week";

const ROW = 3; // rem per hour

/**
 * docs/04 WeekGrid: days as columns × hours as rows, slots as blocks, working hours shaded, free cells tappable.
 * `days` is the whole week on desktop and the selected day on a phone. Several clients may share an hour (docs/06 #20): their
 * blocks sit side by side (initials only when three or more share a desktop column), each block is as tall as its slot, and a
 * tap on the free part of a partly used hour starts there.
 */
export function WeekGrid({
  week,
  days,
  onFreeCell,
  onSlot,
}: {
  week: CoachWeek;
  days: number[];
  /** A tap on an hour cell: the weekday and the start in minutes (the hour, or the free part of a partly used hour). */
  onFreeCell: (weekday: number, startMinutes: number) => void;
  onSlot: (slot: Slot) => void;
}) {
  const ranges = [
    ...week.availability.map((a) => ({ start: toMinutes(a.start_time), end: toMinutes(a.end_time) })),
    ...week.slots.map((s) => ({ start: toMinutes(s.start_time), end: toMinutes(s.start_time) + s.duration_minutes })),
  ];
  const hours = gridHours(ranges);
  const first = hours[0] * 60;
  const busy = new Map(days.map((d) => [d, week.slots.filter((s) => s.weekday === d).map((s) => ({ id: s.id, start: toMinutes(s.start_time), end: toMinutes(s.start_time) + s.duration_minutes }))]));
  // blocks that share a time on the same day sit side by side
  const lanes = new Map(days.flatMap((d) => [...laneLayout(busy.get(d) ?? [])]));
  const working = (weekday: number, hour: number) =>
    week.availability.some((a) => a.weekday === weekday && toMinutes(a.start_time) <= hour * 60 && toMinutes(a.end_time) >= hour * 60 + 60);

  return (
    <div
      role="grid"
      aria-label={t("schedule.gridLabel", { coach: week.coach.name })}
      data-testid="week-grid"
      className="grid overflow-x-auto rounded-lg border"
      style={{ gridTemplateColumns: `3.25rem repeat(${days.length}, minmax(${days.length > 1 ? "6.5rem" : "0"}, 1fr))`, gridTemplateRows: `2.5rem repeat(${hours.length}, ${ROW}rem)` }}
    >
      <div className="sticky start-0 z-20 border-b bg-background" />
      {days.map((d, i) => (
        <div key={d} role="columnheader" aria-current={dateInWeek(week.week_start, d) === week.today ? "date" : undefined} className={cn("grid place-items-center border-b border-s bg-background text-sm font-medium", dateInWeek(week.week_start, d) === week.today && "text-primary underline underline-offset-4")} style={{ gridColumn: i + 2, gridRow: 1 }}>
          <span>{t(`weekday.short.${d}` as MessageKey)} <span className="text-muted-foreground">{dateInWeek(week.week_start, d).slice(8)}</span></span>
        </div>
      ))}
      {hours.map((h, r) => (
        <div key={h} className="sticky start-0 z-10 border-b bg-background pe-1 pt-1 text-end text-xs text-muted-foreground" style={{ gridColumn: 1, gridRow: r + 2 }}>
          {fromMinutes(h * 60)}
        </div>
      ))}
      {days.flatMap((d, i) =>
        hours.map((h, r) => {
          const at = cellStart(busy.get(d) ?? [], h);
          const cellLabel = t("schedule.freeCell", { day: t(`weekday.${d}` as MessageKey), time: fromMinutes(at) });
          return week.can_edit ? (
            <button
              key={`${d}-${h}`}
              type="button"
              aria-label={cellLabel}
              onClick={() => onFreeCell(d, at)}
              className={cn(
                "group grid place-items-center border-b border-s focus-visible:z-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                working(d, h) ? "bg-background hover:bg-accent" : "bg-muted/60 hover:bg-accent",
              )}
              style={{ gridColumn: i + 2, gridRow: r + 2 }}
            >
              <Plus aria-hidden className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
            </button>
          ) : (
            <div key={`${d}-${h}`} className={cn("border-b border-s", working(d, h) ? "bg-background" : "bg-muted/60")} style={{ gridColumn: i + 2, gridRow: r + 2 }} />
          );
        }),
      )}
      {week.slots
        .filter((s) => days.includes(s.weekday))
        .map((s) => {
          const start = toMinutes(s.start_time) - first;
          const date = dateInWeek(week.week_start, s.weekday);
          const skipped = s.skipped.includes(date);
          const notYet = s.starts_on > date || (s.ends_on !== null && s.ends_on < date);
          const { lane, lanes: of } = lanes.get(s.id) ?? { lane: 0, lanes: 1 };
          // a block shorter than 45 minutes has room for one line: the details follow the name
          const short = s.duration_minutes < 45;
          // three or more side by side in a desktop column leave ~40px each: initials only (the title and label keep the name)
          const tight = days.length > 1 && of >= 3;
          const details = (
            <>
              {s.start_time}
              {s.kind === "client" && s.credits_left !== null ? <span className={cn(s.credits_left <= 0 && "font-medium text-destructive")}> · {t("schedule.left", { n: s.credits_left })}</span> : null}
              {skipped ? ` · ${t("schedule.skipped")}` : ""}
            </>
          );
          return (
            <button
              key={s.id}
              type="button"
              data-testid="slot"
              onClick={() => onSlot(s)}
              title={`${slotTitle(s)} · ${s.start_time}`}
              aria-label={t("schedule.slotLabel", { day: t(`weekday.${s.weekday}` as MessageKey), time: s.start_time, what: slotTitle(s) })}
              className={cn(
                "z-10 m-0.5 flex flex-col items-start self-start overflow-hidden rounded-md border px-2 text-start text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                short ? "justify-center py-0" : "py-1",
                s.kind === "client" ? "border-primary/40 bg-primary/10" : s.kind === "class" ? "border-info/40 bg-info/10" : "border-border bg-muted",
                (skipped || notYet) && "opacity-50",
              )}
              style={{
                gridColumn: days.indexOf(s.weekday) + 2,
                gridRow: `${Math.floor(start / 60) + 2} / span ${Math.max(1, Math.ceil((start % 60 + s.duration_minutes) / 60))}`,
                marginTop: `${((start % 60) / 60) * ROW}rem`,
                // as tall as the slot (at least half an hour), so the free part of a partly used hour stays tappable
                height: `calc(${(Math.max(30, s.duration_minutes) / 60) * ROW}rem - 0.25rem)`,
                ...(of > 1 ? { justifySelf: "start", width: `calc(${100 / of}% - 0.25rem)`, marginInlineStart: `calc(${(lane * 100) / of}% + 0.125rem)` } : {}),
              }}
            >
              {tight ? (
                <span className={cn("w-full truncate font-medium", skipped && "line-through", s.kind === "client" && s.credits_left !== null && s.credits_left <= 0 && "text-destructive")}>
                  {initials(slotTitle(s))}
                </span>
              ) : (
                <>
                  <span className={cn("w-full truncate font-medium", skipped && "line-through")}>
                    {slotTitle(s)}
                    {short ? <span className="font-normal text-muted-foreground"> · {details}</span> : null}
                  </span>
                  {short ? null : <span className="w-full truncate text-muted-foreground">{details}</span>}
                </>
              )}
            </button>
          );
        })}
    </div>
  );
}

/** "Mostafa Kamal" → "MK": what fits in a narrow block. */
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2);

export function slotTitle(s: Pick<Slot, "kind" | "client_name" | "label">): string {
  if (s.kind === "client") return s.client_name ?? t("schedule.kind.client");
  return s.label || t(s.kind === "class" ? "schedule.kind.class" : "schedule.kind.blocked");
}

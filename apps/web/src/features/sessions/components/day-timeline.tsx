"use client";

import { t, type MessageKey } from "@gymos/i18n";
import { formatTime } from "@gymos/api/format";
import type { CoachDay, DaySession, Outcome } from "@gymos/api/sessions/coach";
import { cairoMinutes, freeGaps, fromMinutes, toMinutes } from "@gymos/api/sessions/week";
import { SessionRow } from "./session-row";

type Item =
  | { kind: "session"; at: number; session: DaySession }
  | { kind: "block"; at: number; label: string; time: string; blockKind: string }
  | { kind: "gap"; at: number; end: number };

/** The day as a timeline: sessions, classes and blocked hours, and the free gaps inside working hours. */
export function DayTimeline({ day, canRecord, queuedIds, onOutcome }: { day: CoachDay; canRecord: boolean; queuedIds: Set<string>; onOutcome: (s: DaySession, o: Outcome) => void }) {
  const busy = [
    ...day.sessions.filter((s) => s.status !== "cancelled").map((s) => ({ start: cairoMinutes(s.starts_at), end: cairoMinutes(s.starts_at) + s.duration_minutes })),
    ...day.blocks.map((b) => ({ start: cairoMinutes(b.starts_at), end: cairoMinutes(b.starts_at) + b.duration_minutes })),
  ];
  const working = day.availability.map((a) => ({ start: toMinutes(a.start_time), end: toMinutes(a.end_time) }));
  const items: Item[] = [
    ...day.sessions.map((s) => ({ kind: "session" as const, at: cairoMinutes(s.starts_at), session: s })),
    ...day.blocks.map((b) => ({
      kind: "block" as const,
      at: cairoMinutes(b.starts_at),
      label: b.label || t(`schedule.kind.${b.kind}` as MessageKey),
      time: `${formatTime(b.starts_at)} · ${t("schedule.minutes", { n: b.duration_minutes })}`,
      blockKind: b.kind,
    })),
    ...freeGaps(working, busy, 60).map((g) => ({ kind: "gap" as const, at: g.start, end: g.end })),
  ].sort((a, b) => a.at - b.at || (a.kind === "gap" ? 1 : -1));

  return (
    <ol className="grid gap-2" aria-label={t("today.timeline")}>
      {items.map((it) =>
        it.kind === "session" ? (
          <SessionRow key={it.session.id} session={it.session} canRecord={canRecord} queued={queuedIds.has(it.session.id)} onOutcome={onOutcome} />
        ) : it.kind === "block" ? (
          <li key={`b-${it.at}-${it.label}`} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 rounded-lg border border-dashed bg-muted/50 p-3 text-sm md:px-4">
            <span className="tabular-nums text-muted-foreground">{fromMinutes(it.at)}</span>
            <span><span className="font-medium">{it.label}</span> <span className="text-muted-foreground">{it.time}</span></span>
          </li>
        ) : (
          <li key={`g-${it.at}`} className="flex items-center gap-2 px-3 py-0.5 text-xs text-muted-foreground before:h-px before:w-8 before:bg-border md:px-4">
            {t("today.free", { from: fromMinutes(it.at), to: fromMinutes(it.end) })}
          </li>
        ),
      )}
    </ol>
  );
}

"use client";

import { AlertTriangle, CloudOff, HeartPulse } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { DaySession, Outcome } from "../queries/coach";

const OUTCOMES: Outcome[] = ["completed", "no_show", "cancelled"];

/** One session on the coach's day: who, when, sessions left with me, flags; one tap per outcome. */
export function SessionRow({
  session: s,
  canRecord,
  queued,
  onOutcome,
}: {
  session: DaySession;
  canRecord: boolean;
  queued: boolean;
  onOutcome: (s: DaySession, outcome: Outcome) => void;
}) {
  return (
    <li data-testid="session-row" data-status={s.status} className="grid gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <span className="text-sm text-muted-foreground">
            {formatTime(s.starts_at)} · {t("schedule.minutes", { n: s.duration_minutes })}
            {s.is_walk_in ? ` · ${t("today.walkIn")}` : ""}
          </span>
          <Link href={`/coach/clients/${s.client_id}`} className="font-medium underline-offset-4 hover:underline">{s.client_name}</Link>
          <span className="flex flex-wrap gap-1">
            <Badge variant={s.credits_left > 0 ? "secondary" : "destructive"} data-testid="credits-left">{t("today.left", { n: s.credits_left })}</Badge>
            {s.unpaid ? <Badge variant="destructive">{t("today.unpaid")}</Badge> : null}
            {s.injuries ? <Badge variant="warning" title={s.injuries}><HeartPulse aria-hidden className="me-1 size-3" />{t("today.injury")}</Badge> : null}
            {s.at_risk ? <Badge variant="outline">{t("today.atRisk")}</Badge> : null}
            {s.waived ? <Badge variant="outline">{t("today.waived")}</Badge> : null}
            {s.pending_approval ? <Badge variant="warning">{t("today.pendingApproval")}</Badge> : null}
            {queued ? <Badge variant="outline" data-testid="queued"><CloudOff aria-hidden className="me-1 size-3" />{t("today.queued")}</Badge> : null}
          </span>
        </div>
        {s.injuries ? <p className="max-w-40 text-end text-xs text-muted-foreground"><AlertTriangle aria-hidden className="me-1 inline size-3" />{s.injuries}</p> : null}
      </div>
      {canRecord ? (
        <div role="group" aria-label={t("today.outcomeFor", { name: s.client_name })} className="grid grid-cols-3 gap-2">
          {OUTCOMES.map((o) => (
            <button
              key={o}
              type="button"
              aria-pressed={s.status === o}
              disabled={s.pending_approval}
              onClick={() => s.status !== o && onOutcome(s, o)}
              className={cn(
                "min-h-tap rounded-md border px-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                s.status === o
                  ? o === "completed" ? "border-success bg-success text-success-foreground" : o === "no_show" ? "border-warning bg-warning text-warning-foreground" : "border-foreground bg-foreground text-background"
                  : "bg-background hover:bg-accent",
              )}
            >
              {t(`today.outcome.${o}` as MessageKey)}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t(`session.status.${s.status}` as MessageKey)}</p>
      )}
    </li>
  );
}

"use client";

import Link from "next/link";
import { daysSince, formatDateTime } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { allowedMoves, stageLabel, type OpenStage } from "@gymos/api/leads/labels";
import type { LeadRow } from "@gymos/api/leads/leads";
import { SlaBadge } from "./lead-badges";

/** Pipeline card: name, source, days in stage, next follow-up, SLA; "Move to" for keyboard/touch, draggable on desktop. */
export function LeadCard({ lead, onMove }: { lead: LeadRow; onMove: (lead: LeadRow, to: OpenStage | "lost") => void }) {
  const moves = allowedMoves(lead.status);
  return (
    <li
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/lead-id", lead.id)}
      data-testid="lead-card"
      className="grid gap-2 rounded-lg border bg-card p-3"
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/sales/leads/${lead.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {lead.full_name}
        </Link>
        <SlaBadge state={lead.sla_state as "due"} dueAt={lead.first_contact_due_at} />
      </div>
      <p className="text-xs text-muted-foreground">
        {[lead.source_name, t("pipeline.daysInStage", { n: daysSince(lead.stage_since) }), lead.owner_name].filter(Boolean).join(" · ")}
      </p>
      {lead.next_follow_up_at ? <p className="text-xs">{t("pipeline.nextFollowUp", { when: formatDateTime(lead.next_follow_up_at) })}</p> : null}
      {moves.length ? (
        <label className="grid">
          <span className="sr-only">{t("pipeline.moveLead", { name: lead.full_name })}</span>
          <select
            value=""
            onChange={(e) => e.target.value && onMove(lead, e.target.value as OpenStage | "lost")}
            className="min-h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">{t("pipeline.moveTo")}</option>
            {moves.map((m) => (
              <option key={m} value={m}>
                {t(stageLabel(m))}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </li>
  );
}

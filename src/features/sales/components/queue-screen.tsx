"use client";

import Link from "next/link";
import { useState } from "react";
import { ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { useSalesMutation } from "@/features/leads/hooks/use-leads";
import { assignLead } from "@/features/leads/queries/leads";
import { salesErrorKey } from "@/features/leads/errors";
import { ReassignSheet } from "@/features/leads/components/reassign-sheet";
import { stageLabel } from "@/features/leads/labels";
import { formatDateTime, shortDuration } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useQueue } from "../hooks/use-sales";
import { FlagBanner } from "./flag-banner";
import { ApprovalsSection } from "./approvals-section";
import { ReviewItem } from "./review-item";

function Section({ id, title, count, children, action }: { id: string; title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={`q-${id}`} data-testid={`queue-${id}`} className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id={`q-${id}`} className="font-semibold">{title} <span className="text-muted-foreground">({count})</span></h2>
        {action}
      </div>
      {count === 0 ? <p className="text-sm text-muted-foreground">{t("queue.nothing")}</p> : children}
    </section>
  );
}

/** /sales/queue (sales manager): flags, unassigned inbound leads (assign / round robin all), review, SLA breaches, stale leads. */
export function QueueScreen() {
  const me = useMe();
  const branchId = me.active.branchId ?? "";
  const { data, isPending, isError, refetch } = useQueue(branchId);
  const [assigning, setAssigning] = useState<{ id: string; name: string } | null>(null);
  const roundRobin = useSalesMutation(async (ids: string[]) => {
    for (const id of ids) await assignLead(id, null); // one at a time: fn_round_robin_next advances the rotation per lead
  });

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("queue.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  return (
    <div className="grid gap-6">
      <FlagBanner flags={data.flags} showAssignee />
      <Section
        id="unassigned"
        title={t("queue.unassigned")}
        count={data.unassigned.length}
        action={data.unassigned.length ? (
          <Button size="sm" disabled={roundRobin.isPending} onClick={() => roundRobin.mutate(data.unassigned.map((l) => l.id))}>{t("queue.roundRobinAll")}</Button>
        ) : null}
      >
        {roundRobin.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(roundRobin.error))}</p> : null}
        <ul className="grid gap-2">
          {data.unassigned.map((l) => (
            <li key={l.id} data-testid="unassigned-lead" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <span className="grid">
                <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
                <span className="text-xs text-muted-foreground">{[l.source_name, formatDateTime(l.created_at)].filter(Boolean).join(" · ")}</span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setAssigning({ id: l.id, name: l.full_name })}>{t("leads.assign")}</Button>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="review" title={t("queue.review")} count={data.review.length}>
        <ul className="grid gap-2">{data.review.map((l) => <ReviewItem key={l.id} lead={l} />)}</ul>
      </Section>
      <ApprovalsSection branchId={branchId} />
      <Section id="sla" title={t("queue.sla")} count={data.sla_breaches.length}>
        <ul className="grid gap-2">
          {data.sla_breaches.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
              <span className="flex items-center gap-2 text-sm">{l.owner_name}<Badge variant="destructive">{t("sla.breached", { time: shortDuration(Date.now() - new Date(l.first_contact_due_at).getTime()) })}</Badge></span>
            </li>
          ))}
        </ul>
      </Section>
      <Section id="stale" title={t("queue.stale")} count={data.stale.length}>
        <ul className="grid gap-2">
          {data.stale.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
              <span className="text-sm text-muted-foreground">{[t(stageLabel(l.status)), l.owner_name, l.last_touch_at ? t("queue.lastTouch", { when: formatDateTime(l.last_touch_at) }) : t("queue.neverTouched")].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </Section>
      {assigning ? <ReassignSheet open onClose={() => setAssigning(null)} lead={{ id: assigning.id, name: assigning.name, branchId, ownerId: null }} /> : null}
    </div>
  );
}

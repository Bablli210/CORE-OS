"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { RowList, Section as UiSection } from "@/components/layout";
import { ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { assignLead } from "@gymos/api/leads/leads";
import { salesErrorKey } from "@gymos/api/leads/errors";
import { ReassignSheet } from "@/features/leads/components/reassign-sheet";
import { stageLabel } from "@gymos/api/leads/labels";
import { formatDateTime, shortDuration } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useQueue } from "@gymos/api/sales/use-sales";
import { FlagBanner } from "./flag-banner";
import { ApprovalsSection } from "./approvals-section";
import { ReviewItem } from "./review-item";

/** A queue part with work in it: title, count, rows. An empty one collapses to one "all clear" line (EmptyRow). */
function Section({ id, title, count, children, action }: { id: string; title: string; count: number; children: React.ReactNode; action?: React.ReactNode }) {
  if (count === 0) return <EmptyRow id={id} title={title} />;
  return (
    <UiSection id={`q-${id}`} testId={`queue-${id}`} title={title} count={count} action={action} plain>
      {children}
    </UiSection>
  );
}

function EmptyRow({ id, title }: { id: string; title: string }) {
  return (
    <li data-testid={`queue-${id}`} className="flex items-center justify-between gap-2 p-3 text-sm md:p-4">
      <span className="flex items-center gap-2">
        <CheckCircle2 aria-hidden className="size-4 text-success" />
        {title}
      </span>
      <span className="text-muted-foreground">{t("queue.nothing")}</span>
    </li>
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

  const parts: { id: string; title: string; count: number; node: React.ReactNode; action?: React.ReactNode }[] = [
    {
      id: "unassigned",
      title: t("queue.unassigned"),
      count: data.unassigned.length,
      action: <Button size="sm" disabled={roundRobin.isPending} onClick={() => roundRobin.mutate(data.unassigned.map((l) => l.id))}>{t("queue.roundRobinAll")}</Button>,
      node: (
        <>
          {roundRobin.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(roundRobin.error))}</p> : null}
          <RowList>
            {data.unassigned.map((l) => (
              <li key={l.id} data-testid="unassigned-lead" className="flex flex-wrap items-center justify-between gap-2 p-3 md:p-4">
                <span className="grid">
                  <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
                  <span className="text-xs text-muted-foreground">{[l.source_name, formatDateTime(l.created_at)].filter(Boolean).join(" · ")}</span>
                </span>
                <Button size="sm" variant="outline" onClick={() => setAssigning({ id: l.id, name: l.full_name })}>{t("leads.assign")}</Button>
              </li>
            ))}
          </RowList>
        </>
      ),
    },
    { id: "review", title: t("queue.review"), count: data.review.length, node: <ul className="grid gap-2">{data.review.map((l) => <ReviewItem key={l.id} lead={l} />)}</ul> },
    {
      id: "sla",
      title: t("queue.sla"),
      count: data.sla_breaches.length,
      node: (
        <RowList>
          {data.sla_breaches.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 md:p-4">
              <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
              <span className="flex items-center gap-2 text-sm">{l.owner_name}<Badge variant="destructive">{t("sla.breached", { time: shortDuration(Date.now() - new Date(l.first_contact_due_at).getTime()) })}</Badge></span>
            </li>
          ))}
        </RowList>
      ),
    },
    {
      id: "stale",
      title: t("queue.stale"),
      count: data.stale.length,
      node: (
        <RowList>
          {data.stale.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 p-3 md:p-4">
              <Link href={`/sales/leads/${l.id}`} className="font-medium underline-offset-4 hover:underline">{l.full_name}</Link>
              <span className="text-sm text-muted-foreground">{[t(stageLabel(l.status)), l.owner_name, l.last_touch_at ? t("queue.lastTouch", { when: formatDateTime(l.last_touch_at) }) : t("queue.neverTouched")].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </RowList>
      ),
    },
  ];
  const busy = parts.filter((p) => p.count > 0);
  const clear = parts.filter((p) => p.count === 0);

  return (
    <div className="grid gap-8">
      <FlagBanner flags={data.flags} showAssignee />
      {busy.map((p) => (
        <Section key={p.id} id={p.id} title={p.title} count={p.count} action={p.action}>
          {p.node}
        </Section>
      ))}
      <ApprovalsSection branchId={branchId} />
      {clear.length ? (
        <UiSection title={t("queue.allClear")} description={t("queue.allClearHint")} plain>
          <RowList>
            {clear.map((p) => (
              <EmptyRow key={p.id} id={p.id} title={p.title} />
            ))}
          </RowList>
        </UiSection>
      ) : null}
      {assigning ? <ReassignSheet open onClose={() => setAssigning(null)} lead={{ id: assigning.id, name: assigning.name, branchId, ownerId: null }} /> : null}
    </div>
  );
}

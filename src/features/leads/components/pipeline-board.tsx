"use client";

import { Kanban } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useLeads, useSalesMutation } from "../hooks/use-leads";
import { OPEN_STAGES, stageLabel, type OpenStage } from "../labels";
import { setLeadStage, type LeadRow } from "../queries/leads";
import { salesErrorKey } from "../errors";
import { LeadCard } from "./lead-card";
import { LostReasonSheet } from "./lost-reason-sheet";

/** /sales/pipeline: columns by stage on desktop, one stage per tab on mobile. Moves only forward; Lost asks why. */
export function PipelineBoard() {
  const me = useMe();
  const branchId = me.active.branchId ?? "";
  const { data, isPending, isError, refetch } = useLeads(branchId);
  const [tab, setTab] = useState<OpenStage>("new");
  const [losing, setLosing] = useState<LeadRow | null>(null);
  const move = useSalesMutation(({ id, to }: { id: string; to: OpenStage }) => setLeadStage(id, to));

  function onMove(lead: LeadRow, to: OpenStage | "lost") {
    if (to === "lost") setLosing(lead);
    else move.mutate({ id: lead.id, to });
  }

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("pipeline.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;
  if (data.length === 0) return <EmptyState icon={Kanban} title={t("pipeline.empty")} action={{ href: "/sales/leads/new", label: t("action.addLead") }} />;

  const byStage = (s: OpenStage) => data.filter((l) => l.status === s);
  return (
    <div className="grid gap-3">
      {move.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(move.error))}</p> : null}
      <div role="tablist" aria-label={t("pipeline.stages")} className="flex gap-1 overflow-x-auto md:hidden">
        {OPEN_STAGES.map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={cn("min-h-10 shrink-0 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", tab === s ? "bg-primary text-primary-foreground" : "bg-muted")}
          >
            {t(stageLabel(s))} ({byStage(s).length})
          </button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {OPEN_STAGES.map((s) => (
          <section
            key={s}
            aria-label={t(stageLabel(s))}
            data-testid={`stage-${s}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              const lead = data.find((l) => l.id === e.dataTransfer.getData("text/lead-id"));
              if (lead && lead.status !== s) onMove(lead, s);
            }}
            className={cn("grid content-start gap-2 rounded-lg bg-muted/50 p-2", s !== tab && "hidden md:grid")}
          >
            <h2 className="hidden px-1 text-sm font-semibold md:block">
              {t(stageLabel(s))} <span className="text-muted-foreground">({byStage(s).length})</span>
            </h2>
            <ul className="grid gap-2">
              {byStage(s).map((l) => <LeadCard key={l.id} lead={l} onMove={onMove} />)}
            </ul>
            {byStage(s).length === 0 ? <p className="px-1 py-4 text-center text-sm text-muted-foreground">{t("pipeline.stageEmpty")}</p> : null}
          </section>
        ))}
      </div>
      {losing ? <LostReasonSheet open onClose={() => setLosing(null)} lead={{ id: losing.id, name: losing.full_name }} /> : null}
    </div>
  );
}

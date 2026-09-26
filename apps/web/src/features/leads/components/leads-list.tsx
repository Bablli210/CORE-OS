"use client";

import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { daysSince } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useLeads } from "@gymos/api/leads/use-leads";
import { stageLabel, type LeadStatus } from "@gymos/api/leads/labels";
import { SlaBadge, StageBadge } from "./lead-badges";

const FILTERS: LeadStatus[] = ["new", "contacted", "onboarded", "quoted", "won", "lost"];

/** /sales/leads: search by name or phone, one filter (stage), newest first; table on desktop, cards on mobile. */
export function LeadsList() {
  const me = useMe();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LeadStatus | "">("");
  const search = useDeferredValue(query);
  const { data, isPending, isError, refetch } = useLeads(me.active.branchId ?? "", status || undefined, search);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t("common.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("leads.search")} className="ps-9" />
        </label>
        <label className="md:w-48">
          <span className="sr-only">{t("leads.filterStage")}</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as LeadStatus | "")}>
            <option value="">{t("leads.openStages")}</option>
            {FILTERS.map((s) => <option key={s} value={s}>{t(stageLabel(s))}</option>)}
          </Select>
        </label>
        <Link href="/sales/leads/new" className={buttonVariants()}>
          <UserPlus aria-hidden />
          {t("action.addLead")}
        </Link>
      </div>
      {isPending ? (
        <LoadingList label={t("common.loading")} />
      ) : isError ? (
        <ErrorState title={t("leads.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : data.length === 0 ? (
        <EmptyState title={query || status ? t("leads.noMatch") : t("leads.empty")} action={{ href: "/sales/leads/new", label: t("action.addLead") }} />
      ) : (
        <ul className="grid gap-2">
          {data.map((l) => (
            <li key={l.id}>
              <Link
                href={`/sales/leads/${l.id}`}
                className="grid gap-1 rounded-lg border p-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center md:gap-4"
              >
                <span className="font-medium">{l.full_name}</span>
                <span dir="ltr" className="text-start text-sm text-muted-foreground">{l.phone}</span>
                <span className="flex flex-wrap items-center gap-1">
                  <StageBadge status={l.status} />
                  <SlaBadge state={l.sla_state as "due"} dueAt={l.first_contact_due_at} />
                </span>
                <span className="text-sm text-muted-foreground">{[l.owner_name ?? t("capture.unassigned"), t("pipeline.daysInStage", { n: daysSince(l.stage_since) })].join(" · ")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

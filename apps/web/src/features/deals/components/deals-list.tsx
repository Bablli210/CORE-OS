"use client";

import Link from "next/link";
import { Handshake, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useDeferredValue, useState } from "react";
import { RowList } from "@/components/layout";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { formatDate, formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useDeals } from "@gymos/api/deals/use-deals";
import { dealStatusLabel, type DealStatus } from "@gymos/api/deals/labels";

const STATUSES: DealStatus[] = ["draft", "pending_approval", "approved", "partially_paid", "paid", "cancelled"];

/** /sales/deals: search by name, one filter (status), newest first. */
export function DealsList() {
  const me = useMe();
  const [query, setQuery] = useState("");
  const initial = useSearchParams().get("status") as DealStatus | null;
  const [status, setStatus] = useState<DealStatus | "">(initial && STATUSES.includes(initial) ? initial : "");
  const search = useDeferredValue(query);
  const { data, isPending, isError, refetch } = useDeals(me.active.branchId ?? "", status || undefined, search);
  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t("common.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" className="ps-9" placeholder={t("deal.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="md:w-56">
          <span className="sr-only">{t("deal.filterStatus")}</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as DealStatus | "")}>
            <option value="">{t("deal.allStatuses")}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(dealStatusLabel(s))}</option>)}
          </Select>
        </label>
      </div>
      {isPending ? <LoadingList label={t("common.loading")} /> : isError ? (
        <ErrorState title={t("deal.error.list")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : data.length === 0 ? (
        <EmptyState icon={Handshake} title={query || status ? t("deal.noMatch") : t("deal.empty")} body={t("deal.emptyBody")} action={{ href: "/sales/pipeline", label: t("action.openPipeline") }} />
      ) : (
        <RowList>
          {data.map((d) => (
            <li key={d.id}>
              <Link href={`/sales/deals/${d.id}`} className="grid gap-1 p-3 hover:bg-accent md:p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center">
                <span className="font-medium">{d.name}{d.is_renewal ? ` · ${t("deal.renewal")}` : ""}</span>
                <span><Badge variant={d.status === "paid" ? "success" : d.status === "cancelled" ? "destructive" : "outline"}>{t(dealStatusLabel(d.status))}</Badge></span>
                <span className="text-sm">{formatEGP(d.paid_piastres)} / {formatEGP(d.total_piastres)}</span>
                <span className="text-sm text-muted-foreground">{[d.rep_name, formatDate(d.created_at)].filter(Boolean).join(" · ")}</span>
              </Link>
            </li>
          ))}
        </RowList>
      )}
    </div>
  );
}

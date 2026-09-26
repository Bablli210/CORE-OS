"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { PageHeader, RowList, Section } from "@/components/layout";
import { LoadingList } from "@/components/states";
import { Input } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { StageBadge } from "@/features/leads/components/lead-badges";
import { useLeads } from "@gymos/api/leads/use-leads";
import { t } from "@gymos/i18n";

/** /sales/deals/new with no lead or client: pick who the quote is for (a renewal starts from the client's page). */
export function DealTargetPicker() {
  const me = useMe();
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query);
  const { data, isPending } = useLeads(me.active.branchId ?? "", undefined, search);
  return (
    <>
      <PageHeader back={{ href: "/sales/deals", label: t("screen.sales.deals.title") }} title={t("deal.pick.title")} description={t("deal.pick.body")} />
      <Section title={t("deal.pick.lead")} plain>
        <label className="relative">
          <span className="sr-only">{t("common.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input type="search" autoFocus className="ps-9" placeholder={t("leads.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {isPending ? (
          <LoadingList rows={3} label={t("common.loading")} />
        ) : data?.length ? (
          <RowList testId="deal-pick-leads">
            {data.slice(0, 20).map((l) => (
              <li key={l.id}>
                <Link href={`/sales/deals/new?lead=${l.id}`} className="flex items-center justify-between gap-2 p-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-4">
                  <span className="grid min-w-0">
                    <span className="truncate font-medium">{l.full_name}</span>
                    <span dir="ltr" className="text-start text-xs text-muted-foreground">{l.phone}</span>
                  </span>
                  <StageBadge status={l.status} />
                </Link>
              </li>
            ))}
          </RowList>
        ) : (
          <p className="text-sm text-muted-foreground">{t("deal.pick.none")}</p>
        )}
        <p className="text-sm text-muted-foreground">{t("deal.pick.renewal")}</p>
      </Section>
    </>
  );
}

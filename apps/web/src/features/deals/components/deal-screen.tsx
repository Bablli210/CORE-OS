"use client";

import Link from "next/link";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { t } from "@gymos/i18n";
import { useDeal } from "@gymos/api/deals/use-deals";
import { dealStatusLabel } from "@gymos/api/deals/labels";
import { DealBuilder } from "./deal-builder";
import { DealView } from "./deal-view";

/** /sales/deals/[id]: the builder while it is a draft you can edit, otherwise the deal's status and payments. */
export function DealScreen({ id }: { id: string }) {
  const { data: deal, isPending, isError } = useDeal(id);
  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("deal.error.load")} body={t("deal.error.loadBody")} action={<Link href="/sales/deals" className={buttonVariants({ variant: "outline" })}>{t("action.allDeals")}</Link>} />;
  const who = deal.client?.full_name ?? deal.lead?.full_name ?? "";
  return (
    <>
      <PageHeader
        title={t("deal.titleFor", { name: who })}
        description={[deal.branch_name, deal.rep_name && t("deal.rep", { name: deal.rep_name }), deal.is_renewal ? t("deal.renewal") : null].filter(Boolean).join(" · ")}
        actions={<Badge variant={deal.status === "paid" ? "success" : deal.status === "cancelled" ? "destructive" : "outline"} data-testid="deal-status">{t(dealStatusLabel(deal.status))}</Badge>}
      />
      {deal.lead ? <p className="-mt-2 mb-4 text-sm"><Link className="underline-offset-4 hover:underline" href={`/sales/leads/${deal.lead.id}`}>{t("deal.openLead")}</Link></p> : null}
      {deal.status === "draft" && deal.can_edit ? <DealBuilder deal={deal} /> : <DealView deal={deal} />}
    </>
  );
}

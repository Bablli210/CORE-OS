import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { DealsList } from "@/features/deals/components/deals-list";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.deals.title") };

export default function DealsPage() {
  return (
    <>
      <PageHeader title={t("screen.sales.deals.title")} description={t("screen.sales.deals.job")} />
      <DealsList />
    </>
  );
}

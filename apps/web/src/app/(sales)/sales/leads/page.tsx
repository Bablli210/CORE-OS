import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { LeadsList } from "@/features/leads/components/leads-list";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.leads.title") };

export default function LeadsPage() {
  return (
    <>
      <PageHeader title={t("screen.sales.leads.title")} description={t("screen.sales.leads.job")} />
      <LeadsList />
    </>
  );
}

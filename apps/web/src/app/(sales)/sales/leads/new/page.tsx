import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { LeadCaptureForm } from "@/features/leads/components/lead-capture-form";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.leadNew.title") };

export default function NewLeadPage() {
  return (
    <div className="max-w-xl">
      <PageHeader title={t("screen.sales.leadNew.title")} description={t("screen.sales.leadNew.job")} />
      <LeadCaptureForm />
    </div>
  );
}

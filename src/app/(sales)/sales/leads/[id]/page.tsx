import type { Metadata } from "next";
import { LeadDetailScreen } from "@/features/leads/components/lead-detail";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.lead.title") };

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LeadDetailScreen id={id} />;
}

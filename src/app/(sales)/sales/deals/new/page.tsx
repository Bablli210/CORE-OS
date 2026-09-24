import type { Metadata } from "next";
import { NewDeal } from "@/features/deals/components/new-deal";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.dealNew.title") };

export default async function NewDealPage({ searchParams }: { searchParams: Promise<{ lead?: string; client?: string }> }) {
  const { lead, client } = await searchParams;
  return <NewDeal leadId={lead} clientId={client} />;
}

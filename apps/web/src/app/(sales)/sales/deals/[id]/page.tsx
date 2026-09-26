import type { Metadata } from "next";
import { DealScreen } from "@/features/deals/components/deal-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.sales.deal.title") };

export default async function DealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DealScreen id={id} />;
}

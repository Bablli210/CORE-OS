import type { Metadata } from "next";
import { SalesClientScreen } from "@/features/credits/components/sales-client";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("client.title") };

export default async function SalesClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesClientScreen id={id} />;
}

import type { Metadata } from "next";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { t } from "@/lib/i18n";
import { requireRole } from "@/features/auth/guard";

export const metadata: Metadata = { title: t("screen.sales.queue.title") };

export default async function Page() {
  await requireRole("sales", ["sales_manager"], "/sales/queue");
  return <ScreenPlaceholder screen="sales.queue" />;
}

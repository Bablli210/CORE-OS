import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { requireRole } from "@/features/auth/guard";
import { QueueScreen } from "@/features/sales/components/queue-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.sales.queue.title") };

export default async function Page() {
  await requireRole("sales", ["sales_manager"], "/sales/queue");
  return (
    <>
      <PageHeader title={t("screen.sales.queue.title")} description={t("screen.sales.queue.job")} />
      <QueueScreen />
    </>
  );
}

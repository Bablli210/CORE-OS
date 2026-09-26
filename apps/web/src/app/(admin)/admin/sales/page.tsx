import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { AdminSales } from "@/features/analytics/components/admin/admin-sales";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.sales.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <AdminSales />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { AdminOverview } from "@/features/analytics/components/admin/admin-overview";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.admin.overview.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <AdminOverview />
    </Suspense>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { AdminCoaching } from "@/features/analytics/components/admin/admin-coaching";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.coaching.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <AdminCoaching />
    </Suspense>
  );
}

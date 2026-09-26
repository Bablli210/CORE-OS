import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { TargetsGrid } from "@/features/analytics/components/admin/targets-grid";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.targets.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <TargetsGrid />
    </Suspense>
  );
}

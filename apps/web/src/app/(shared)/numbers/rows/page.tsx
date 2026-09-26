import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { RowsScreen } from "@/features/analytics/components/rows-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("rows.pageTitle") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <RowsScreen />
    </Suspense>
  );
}

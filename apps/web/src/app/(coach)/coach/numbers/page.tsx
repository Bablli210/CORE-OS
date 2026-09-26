import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { CoachNumbers } from "@/features/analytics/components/coach-numbers";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("numbers.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <CoachNumbers />
    </Suspense>
  );
}

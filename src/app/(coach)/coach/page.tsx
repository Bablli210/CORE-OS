import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { TodayScreen } from "@/features/sessions/components/today-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("today.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <TodayScreen />
    </Suspense>
  );
}

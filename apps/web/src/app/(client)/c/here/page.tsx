import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { HereScreen } from "@/features/training/components/here-screen";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("here.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("here.checking")} rows={1} />}>
      <HereScreen />
    </Suspense>
  );
}

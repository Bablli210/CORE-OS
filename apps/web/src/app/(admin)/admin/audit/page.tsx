import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingList } from "@/components/states";
import { AuditExplorer } from "@/features/analytics/components/admin/audit-explorer";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("screen.admin.audit.title") };

export default function Page() {
  return (
    <Suspense fallback={<LoadingList label={t("common.loading")} />}>
      <AuditExplorer />
    </Suspense>
  );
}

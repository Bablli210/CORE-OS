import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { ScreenPlaceholder } from "@/components/screen-placeholder";
import { requireArea } from "@/features/auth/guard";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t("screen.checkin.title") };

/** Reception kiosk (front desk account) — built in M4. */
export default async function CheckinPage() {
  const me = await requireArea("sales");
  return (
    <AppShell me={me}>
      <ScreenPlaceholder screen="checkin" />
    </AppShell>
  );
}

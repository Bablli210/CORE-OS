import type { Metadata } from "next";
import { AppShell } from "@/components/shell/app-shell";
import { requireArea } from "@/features/auth/guard";
import { KioskScreen } from "@/features/sessions/components/kiosk-screen";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("kiosk.title") };

/** Reception kiosk (front desk account): check in by phone; refused members can be sent to sales in one tap. */
export default async function CheckinPage() {
  const me = await requireArea("sales");
  return (
    <AppShell me={me}>
      <KioskScreen />
    </AppShell>
  );
}

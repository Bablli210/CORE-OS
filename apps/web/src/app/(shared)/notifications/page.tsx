import type { Metadata } from "next";
import { PageHeader } from "@/components/states";
import { NotificationList } from "@/features/notifications/components/notification-list";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("notifications.title") };

export default function NotificationsPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader title={t("notifications.title")} />
      <NotificationList />
    </div>
  );
}

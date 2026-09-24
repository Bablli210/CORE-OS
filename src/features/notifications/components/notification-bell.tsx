"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { t } from "@/lib/i18n";
import { useNotificationsRealtime, useUnreadCount } from "../hooks/use-notifications";

/** Header bell: unread count, live via Realtime. Opens the notification center. */
export function NotificationBell({ userId }: { userId: string }) {
  useNotificationsRealtime(userId);
  const { data: unread = 0 } = useUnreadCount();
  const label = unread > 0 ? t("notifications.bellUnread", { count: unread }) : t("notifications.bell");
  return (
    <Link
      href="/notifications"
      aria-label={label}
      data-testid="notification-bell"
      className="relative inline-flex size-tap items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Bell aria-hidden className="size-5" />
      {unread > 0 ? (
        <span
          data-testid="notification-count"
          className="absolute end-1 top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-semibold text-destructive-foreground"
        >
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  );
}

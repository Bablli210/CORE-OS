"use client";

import Link from "next/link";
import { BellOff } from "lucide-react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { homeFor } from "@gymos/api/auth/roles";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { useMarkRead, useNotifications } from "@gymos/api/notifications/use-notifications";
import { notificationHref, type NotificationRow } from "@gymos/api/notifications/notifications";

const timeFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo" });

export function NotificationList() {
  const me = useMe();
  const { data, isPending, isError, refetch } = useNotifications();
  const markRead = useMarkRead();

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError)
    return (
      <ErrorState
        title={t("notifications.error")}
        body={t("error.retryHint")}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  if (data.length === 0)
    return <EmptyState icon={BellOff} title={t("notifications.empty")} body={t("notifications.emptyBody")} action={{ href: homeFor(me.active), label: t("notifications.backHome") }} />;

  const unreadIds = data.filter((n) => !n.read_at).map((n) => n.id);
  return (
    <div className="grid gap-3">
      {unreadIds.length ? (
        <Button variant="outline" className="justify-self-end" disabled={markRead.isPending} onClick={() => markRead.mutate(undefined)}>
          {t("notifications.markAllRead")}
        </Button>
      ) : null}
      {markRead.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t("notifications.markError")}
        </p>
      ) : null}
      <ul className="grid gap-2">
        {data.map((n) => (
          <NotificationItem key={n.id} n={n} href={notificationHref(n.data, me.area)} onRead={() => !n.read_at && markRead.mutate([n.id])} />
        ))}
      </ul>
    </div>
  );
}

function NotificationItem({ n, href, onRead }: { n: NotificationRow; href: string | null; onRead: () => void }) {
  const content = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className={cn("text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
        {!n.read_at ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-info" aria-label={t("notifications.unread")} /> : null}
      </span>
      {n.body ? <span className="text-sm text-muted-foreground">{n.body}</span> : null}
      <time dateTime={n.created_at} className="text-xs text-muted-foreground">
        {timeFormat.format(new Date(n.created_at))}
      </time>
    </>
  );
  const itemClass = cn(
    "grid w-full gap-1 rounded-lg border p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    n.read_at ? "bg-background" : "bg-muted",
  );
  return (
    <li data-testid="notification-item">
      {href ? (
        <Link href={href} onClick={onRead} className={itemClass}>
          {content}
        </Link>
      ) : (
        <button type="button" onClick={onRead} className={itemClass}>
          {content}
        </button>
      )}
    </li>
  );
}

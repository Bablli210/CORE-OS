import Link from "next/link";
import type { Me } from "@/features/auth/me";
import { MeProvider } from "@/features/auth/me-context";
import { homeFor } from "@/features/auth/roles";
import { NotificationBell } from "@/features/notifications/components/notification-bell";
import { t, type MessageKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { BottomNav } from "./bottom-nav";
import { navFor } from "./nav";
import { RoleSwitcher } from "./role-switcher";
import { SideNav } from "./side-nav";
import { SignOutButton } from "./sign-out-button";

/** docs/04 `AppShell`: header (branch, role switcher, bell), side nav on desktop, bottom tabs on mobile. */
export function AppShell({ me, children }: { me: Me; children: React.ReactNode }) {
  const { primary, secondary } = navFor(me.active.role);
  return (
    <MeProvider me={me}>
      <div className="flex min-h-dvh flex-col">
        <header className="sticky top-0 z-20 flex min-h-14 items-center gap-2 border-b bg-background px-4">
          <Link href={homeFor(me.active)} className="me-auto grid leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="text-sm font-semibold">{t("app.name")}</span>
            {/* With several roles the switcher shows the context; keep the phone header on one line. */}
            <span className={cn("text-xs text-muted-foreground", me.memberships.length > 1 && "hidden md:inline")} data-testid="active-context">
              {t(`role.${me.active.role}` as MessageKey)} · {me.active.branchName ?? t("shell.allBranches")}
            </span>
          </Link>
          <RoleSwitcher />
          <NotificationBell userId={me.profile.id} />
          <SignOutButton />
        </header>
        <div className="flex flex-1">
          <SideNav primary={primary} secondary={secondary} />
          <main className="min-w-0 flex-1 px-4 pb-28 pt-4 md:px-8 md:pb-8 md:pt-6">{children}</main>
        </div>
        <BottomNav items={primary} />
      </div>
    </MeProvider>
  );
}

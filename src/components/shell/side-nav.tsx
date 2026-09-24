"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { activeHref, type NavItem } from "./nav";
import { NavIcon } from "./nav-icon";

/** Desktop navigation (md and up). */
export function SideNav({ primary, secondary }: { primary: NavItem[]; secondary: NavItem[] }) {
  const pathname = usePathname();
  const current = activeHref([...primary, ...secondary], pathname);
  const item = (i: NavItem) => (
    <li key={i.href}>
      <Link
        href={i.href}
        aria-current={current === i.href ? "page" : undefined}
        className={cn(
          "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
          current === i.href ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent",
        )}
      >
        <NavIcon name={i.icon} className="size-4" />
        {t(i.label)}
      </Link>
    </li>
  );
  return (
    <nav aria-label={t("shell.mainNav")} className="hidden w-60 shrink-0 border-e border-sidebar-border bg-sidebar p-3 md:block">
      <ul className="grid gap-1">{primary.map(item)}</ul>
      {secondary.length ? <ul className="mt-4 grid gap-1 border-t border-sidebar-border pt-4">{secondary.map(item)}</ul> : null}
    </nav>
  );
}

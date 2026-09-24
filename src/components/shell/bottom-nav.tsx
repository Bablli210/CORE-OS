"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { activeHref, splitForBottomBar, type NavItem } from "./nav";
import { NavIcon } from "./nav-icon";

const tabClass = "flex min-h-bottom-bar flex-1 flex-col items-center justify-center gap-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Mobile tab bar (below md): up to 5 slots, the rest under "More". */
export function BottomNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const { visible, overflow } = splitForBottomBar(items);
  const current = activeHref(items, pathname);
  const overflowActive = overflow.some((i) => i.href === current);

  return (
    <nav aria-label={t("shell.mainNav")} className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="flex">
        {visible.map((i) => (
          <li key={i.href} className="flex flex-1">
            <Link
              href={i.href}
              aria-current={current === i.href ? "page" : undefined}
              className={cn(tabClass, current === i.href ? "font-semibold text-foreground" : "text-muted-foreground")}
            >
              <NavIcon name={i.icon} className="size-5" />
              {t(i.label)}
            </Link>
          </li>
        ))}
        {overflow.length ? (
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={cn(tabClass, overflowActive ? "font-semibold text-foreground" : "text-muted-foreground")}
            >
              <MoreHorizontal aria-hidden className="size-5" />
              {t("nav.more")}
            </button>
          </li>
        ) : null}
      </ul>
      <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title={t("nav.more")} closeLabel={t("common.close")}>
        <ul className="grid gap-1">
          {overflow.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                onClick={() => setMoreOpen(false)}
                aria-current={current === i.href ? "page" : undefined}
                className="flex min-h-tap items-center gap-3 rounded-md px-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <NavIcon name={i.icon} className="size-5" />
                {t(i.label)}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </nav>
  );
}

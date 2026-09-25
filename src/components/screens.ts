import type { MessageKey } from "@/lib/i18n";

export type ScreenInfo = { title: MessageKey; job: MessageKey; milestone: string; action: { href: string; label: MessageKey } };

/** Screens from docs/04 that are placeholders until their milestone: title, job, and where to go meanwhile. */
export const SCREENS = {
  "coach.numbers": { title: "screen.coach.numbers.title", job: "screen.coach.numbers.job", milestone: "M6", action: { href: "/coach", label: "nav.backToday" } },
  "admin.overview": { title: "screen.admin.overview.title", job: "screen.admin.overview.job", milestone: "M6", action: { href: "/admin/people", label: "action.managePeople" } },
  "admin.branches": { title: "screen.admin.branches.title", job: "screen.admin.branches.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.sales": { title: "screen.admin.sales.title", job: "screen.admin.sales.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.coaching": { title: "screen.admin.coaching.title", job: "screen.admin.coaching.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.clients": { title: "screen.admin.clients.title", job: "screen.admin.clients.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.targets": { title: "screen.admin.targets.title", job: "screen.admin.targets.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.audit": { title: "screen.admin.audit.title", job: "screen.admin.audit.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
} satisfies Record<string, ScreenInfo>;

export type ScreenId = keyof typeof SCREENS;

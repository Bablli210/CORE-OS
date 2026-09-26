import type { MessageKey } from "@gymos/i18n";

export type ScreenInfo = { title: MessageKey; job: MessageKey; milestone: string; action: { href: string; label: MessageKey } };

/** Screens from docs/04 that are placeholders until their milestone: title, job, and where to go meanwhile. */
export const SCREENS = {
  "admin.branches": { title: "screen.admin.branches.title", job: "screen.admin.branches.job", milestone: "a later milestone", action: { href: "/admin", label: "action.backOverview" } },
  "admin.clients": { title: "screen.admin.clients.title", job: "screen.admin.clients.job", milestone: "a later milestone", action: { href: "/admin", label: "action.backOverview" } },
} satisfies Record<string, ScreenInfo>;

export type ScreenId = keyof typeof SCREENS;

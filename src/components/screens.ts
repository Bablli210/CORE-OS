import type { MessageKey } from "@/lib/i18n";

export type ScreenInfo = { title: MessageKey; job: MessageKey; milestone: string; action: { href: string; label: MessageKey } };

/** Screens from docs/04 that are placeholders until their milestone: title, job, and where to go meanwhile. */
export const SCREENS = {
  "c.workout": { title: "screen.c.workout.title", job: "screen.c.workout.job", milestone: "M5", action: { href: "/c", label: "nav.backToday" } },
  "c.progress": { title: "screen.c.progress.title", job: "screen.c.progress.job", milestone: "M5", action: { href: "/c", label: "nav.backToday" } },
  "c.credits": { title: "screen.c.credits.title", job: "screen.c.credits.job", milestone: "M5", action: { href: "/c", label: "nav.backToday" } },
  "c.profile": { title: "screen.c.profile.title", job: "screen.c.profile.job", milestone: "M5", action: { href: "/c", label: "nav.backToday" } },
  "coach.today": { title: "screen.coach.today.title", job: "screen.coach.today.job", milestone: "M4", action: { href: "/coach/schedule", label: "action.openWeek" } },
  "coach.clients": { title: "screen.coach.clients.title", job: "screen.coach.clients.job", milestone: "M4", action: { href: "/coach", label: "nav.backToday" } },
  "coach.client": { title: "screen.coach.client.title", job: "screen.coach.client.job", milestone: "M4", action: { href: "/coach/clients", label: "action.allClients" } },
  "coach.program": { title: "screen.coach.program.title", job: "screen.coach.program.job", milestone: "M4", action: { href: "/coach/clients", label: "action.allClients" } },
  "coach.programs": { title: "screen.coach.programs.title", job: "screen.coach.programs.job", milestone: "M4", action: { href: "/coach/clients", label: "action.allClients" } },
  "coach.schedule": { title: "screen.coach.schedule.title", job: "screen.coach.schedule.job", milestone: "M4", action: { href: "/coach", label: "nav.backToday" } },
  "coach.numbers": { title: "screen.coach.numbers.title", job: "screen.coach.numbers.job", milestone: "M6", action: { href: "/coach", label: "nav.backToday" } },
  "coach.team": { title: "screen.coach.team.title", job: "screen.coach.team.job", milestone: "M4", action: { href: "/coach", label: "nav.backToday" } },
  "sales.today": { title: "screen.sales.today.title", job: "screen.sales.today.job", milestone: "M2", action: { href: "/sales/leads/new", label: "action.addLead" } },
  "sales.pipeline": { title: "screen.sales.pipeline.title", job: "screen.sales.pipeline.job", milestone: "M2", action: { href: "/sales/leads/new", label: "action.addLead" } },
  "sales.leads": { title: "screen.sales.leads.title", job: "screen.sales.leads.job", milestone: "M2", action: { href: "/sales/leads/new", label: "action.addLead" } },
  "sales.leadNew": { title: "screen.sales.leadNew.title", job: "screen.sales.leadNew.job", milestone: "M2", action: { href: "/sales", label: "nav.backToday" } },
  "sales.lead": { title: "screen.sales.lead.title", job: "screen.sales.lead.job", milestone: "M2", action: { href: "/sales/leads", label: "action.allLeads" } },
  "sales.deals": { title: "screen.sales.deals.title", job: "screen.sales.deals.job", milestone: "M3", action: { href: "/sales/pipeline", label: "action.openPipeline" } },
  "sales.dealNew": { title: "screen.sales.dealNew.title", job: "screen.sales.dealNew.job", milestone: "M3", action: { href: "/sales/deals", label: "action.allDeals" } },
  "sales.deal": { title: "screen.sales.deal.title", job: "screen.sales.deal.job", milestone: "M3", action: { href: "/sales/deals", label: "action.allDeals" } },
  "sales.numbers": { title: "screen.sales.numbers.title", job: "screen.sales.numbers.job", milestone: "M2", action: { href: "/sales", label: "nav.backToday" } },
  "sales.queue": { title: "screen.sales.queue.title", job: "screen.sales.queue.job", milestone: "M2", action: { href: "/sales", label: "nav.backToday" } },
  "sales.team": { title: "screen.sales.team.title", job: "screen.sales.team.job", milestone: "M2", action: { href: "/sales", label: "nav.backToday" } },
  "admin.overview": { title: "screen.admin.overview.title", job: "screen.admin.overview.job", milestone: "M6", action: { href: "/admin/people", label: "action.managePeople" } },
  "admin.branches": { title: "screen.admin.branches.title", job: "screen.admin.branches.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.sales": { title: "screen.admin.sales.title", job: "screen.admin.sales.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.coaching": { title: "screen.admin.coaching.title", job: "screen.admin.coaching.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.clients": { title: "screen.admin.clients.title", job: "screen.admin.clients.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.money": { title: "screen.admin.money.title", job: "screen.admin.money.job", milestone: "M3", action: { href: "/admin", label: "action.backOverview" } },
  "admin.targets": { title: "screen.admin.targets.title", job: "screen.admin.targets.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "admin.audit": { title: "screen.admin.audit.title", job: "screen.admin.audit.job", milestone: "M6", action: { href: "/admin", label: "action.backOverview" } },
  "checkin": { title: "screen.checkin.title", job: "screen.checkin.job", milestone: "M4", action: { href: "/sales", label: "nav.backToday" } },
} satisfies Record<string, ScreenInfo>;

export type ScreenId = keyof typeof SCREENS;

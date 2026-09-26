import type { AppRole } from "@gymos/api/auth/roles";
import type { MessageKey } from "@gymos/i18n";

export type NavIcon =
  | "today"
  | "workout"
  | "progress"
  | "credits"
  | "profile"
  | "clients"
  | "programs"
  | "schedule"
  | "numbers"
  | "team"
  | "pipeline"
  | "leads"
  | "deals"
  | "queue"
  | "checkin"
  | "overview"
  | "branches"
  | "sales"
  | "coaching"
  | "money"
  | "targets"
  | "people"
  | "settings"
  | "audit";

export type NavItem = { href: string; label: MessageKey; icon: NavIcon };

const client: NavItem[] = [
  { href: "/c", label: "nav.today", icon: "today" },
  { href: "/c/workout", label: "nav.workout", icon: "workout" },
  { href: "/c/progress", label: "nav.progress", icon: "progress" },
  { href: "/c/credits", label: "nav.credits", icon: "credits" },
  { href: "/c/profile", label: "nav.profile", icon: "profile" },
];

// docs/04: Today · Clients · Programs · Numbers (+ Team for the head coach). "My week" is reached from Today
// and sits in the desktop side nav as a secondary item.
const coach: NavItem[] = [
  { href: "/coach", label: "nav.today", icon: "today" },
  { href: "/coach/clients", label: "nav.clients", icon: "clients" },
  { href: "/coach/programs", label: "nav.programs", icon: "programs" },
  { href: "/coach/numbers", label: "nav.numbers", icon: "numbers" },
];
const coachSecondary: NavItem[] = [{ href: "/coach/schedule", label: "nav.schedule", icon: "schedule" }];
const headCoachExtra: NavItem[] = [{ href: "/coach/team", label: "nav.team", icon: "team" }];

// docs/04: Today · Pipeline · Leads · Deals · Numbers; the sales manager also gets Queue · Team.
const sales: NavItem[] = [
  { href: "/sales", label: "nav.today", icon: "today" },
  { href: "/sales/pipeline", label: "nav.pipeline", icon: "pipeline" },
  { href: "/sales/leads", label: "nav.leads", icon: "leads" },
  { href: "/sales/deals", label: "nav.deals", icon: "deals" },
  { href: "/sales/numbers", label: "nav.numbers", icon: "numbers" },
];
const salesManagerExtra: NavItem[] = [
  { href: "/sales/queue", label: "nav.queue", icon: "queue" },
  { href: "/sales/team", label: "nav.team", icon: "team" },
];
// Front desk: check-ins, walk-in leads, payments (docs/01 §4.9).
const frontDesk: NavItem[] = [
  { href: "/sales", label: "nav.today", icon: "today" },
  { href: "/sales/leads/new", label: "nav.newLead", icon: "leads" },
  { href: "/sales/deals", label: "nav.deals", icon: "deals" },
  { href: "/checkin", label: "nav.checkin", icon: "checkin" },
];

// docs/04: Overview · Branches · Sales · Coaching · Clients · Money · Targets · People · Settings · Audit.
const admin: NavItem[] = [
  { href: "/admin", label: "nav.overview", icon: "overview" },
  { href: "/admin/branches", label: "nav.branches", icon: "branches" },
  { href: "/admin/sales", label: "nav.sales", icon: "sales" },
  { href: "/admin/coaching", label: "nav.coaching", icon: "coaching" },
  { href: "/admin/clients", label: "nav.clients", icon: "clients" },
  { href: "/admin/money", label: "nav.money", icon: "money" },
  { href: "/admin/targets", label: "nav.targets", icon: "targets" },
  { href: "/admin/people", label: "nav.people", icon: "people" },
  { href: "/admin/settings", label: "nav.settings", icon: "settings" },
  { href: "/admin/audit", label: "nav.audit", icon: "audit" },
];

/** Primary navigation for the role being acted as. */
export function navFor(role: AppRole): { primary: NavItem[]; secondary: NavItem[] } {
  switch (role) {
    case "client":
      return { primary: client, secondary: [] };
    case "coach":
    case "nutritionist":
      return { primary: coach, secondary: coachSecondary };
    case "head_coach":
      return { primary: [...coach, ...headCoachExtra], secondary: coachSecondary };
    case "sales_rep":
      return { primary: sales, secondary: [] };
    case "sales_manager":
      return { primary: [...sales, ...salesManagerExtra], secondary: [] };
    case "front_desk":
      return { primary: frontDesk, secondary: [] };
    case "top_management":
      return { primary: admin, secondary: [] };
  }
}

/** Bottom bar holds at most 5 slots; beyond that the last slot becomes "More". */
export const BOTTOM_BAR_SLOTS = 5;

export function splitForBottomBar(items: NavItem[]): { visible: NavItem[]; overflow: NavItem[] } {
  if (items.length <= BOTTOM_BAR_SLOTS) return { visible: items, overflow: [] };
  return { visible: items.slice(0, BOTTOM_BAR_SLOTS - 1), overflow: items.slice(BOTTOM_BAR_SLOTS - 1) };
}

/** The nav item that owns a path: exact match, else the longest prefix (so /coach/clients/42 highlights Clients). */
export function activeHref(items: NavItem[], pathname: string): string | null {
  const exact = items.find((i) => i.href === pathname);
  if (exact) return exact.href;
  const prefix = items
    .filter((i) => i.href.split("/").length > 2 && pathname.startsWith(i.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return prefix?.href ?? null;
}

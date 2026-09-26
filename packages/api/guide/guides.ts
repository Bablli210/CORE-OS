import type { MessageKey } from "@gymos/i18n";
import type { AppRole } from "../auth/roles";

/**
 * First-run guides: for each role, the few things that role does every day, in the order to learn them. Shown as a
 * "Getting started" card on the role's home until dismissed, and any time from the help button. A step with `check`
 * is ticked from real data (top management's setup); the others are ticked by the person.
 */
export type SetupCheck = "staff" | "products" | "targets";
export type GuideStep = { id: string; title: MessageKey; body: MessageKey; href: string; check?: SetupCheck };
export type Guide = { id: string; title: MessageKey; intro: MessageKey; steps: GuideStep[] };

const step = (guide: string, id: string, href: string, check?: SetupCheck): GuideStep => ({
  id,
  title: `guide.${guide}.${id}.title` as MessageKey,
  body: `guide.${guide}.${id}.body` as MessageKey,
  href,
  check,
});

const guide = (id: string, steps: GuideStep[]): Guide => ({ id, title: `guide.${id}.title` as MessageKey, intro: `guide.${id}.intro` as MessageKey, steps });

const rep = [
  step("rep", "lead", "/sales/leads/new"),
  step("rep", "contact", "/sales"),
  step("rep", "quote", "/sales/pipeline"),
  step("rep", "numbers", "/sales/numbers"),
];

const coach = [
  step("coach", "hours", "/coach/schedule"),
  step("coach", "slots", "/coach/schedule"),
  step("coach", "record", "/coach"),
  step("coach", "program", "/coach/clients"),
];

export const GUIDES: Record<AppRole, Guide> = {
  client: guide("client", [step("client", "today", "/c"), step("client", "workout", "/c/workout"), step("client", "checkin", "/c/here"), step("client", "credits", "/c/credits")]),
  coach: guide("coach", coach),
  nutritionist: guide("coach", coach),
  head_coach: guide("headCoach", [...coach, step("headCoach", "team", "/coach/team")]),
  sales_rep: guide("rep", rep),
  sales_manager: guide("manager", [...rep.slice(0, 2), step("manager", "queue", "/sales/queue"), step("manager", "team", "/sales/team")]),
  front_desk: guide("desk", [step("desk", "checkin", "/checkin"), step("desk", "walkIn", "/sales/leads/new"), step("desk", "payment", "/sales/deals?status=approved")]),
  top_management: guide("admin", [
    step("admin", "staff", "/admin/people", "staff"),
    step("admin", "products", "/admin/settings?tab=products", "products"),
    step("admin", "targets", "/admin/targets", "targets"),
    step("admin", "rules", "/admin/settings"),
    step("admin", "overview", "/admin"),
  ]),
};

export function guideFor(role: AppRole): Guide {
  return GUIDES[role];
}

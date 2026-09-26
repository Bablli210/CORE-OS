import Link from "next/link";
import { ClipboardCheck, CreditCard, UserPlus } from "lucide-react";
import { t, type MessageKey } from "@gymos/i18n";

const ACTIONS: { href: string; title: MessageKey; body: MessageKey; icon: typeof UserPlus; testId: string }[] = [
  { href: "/checkin", title: "desk.checkin", body: "desk.checkinBody", icon: ClipboardCheck, testId: "desk-checkin" },
  { href: "/sales/leads/new", title: "desk.walkIn", body: "desk.walkInBody", icon: UserPlus, testId: "desk-walk-in" },
  { href: "/sales/deals?status=approved", title: "desk.payment", body: "desk.paymentBody", icon: CreditCard, testId: "desk-payment" },
];

/** Front desk home: the three things the desk does all day, one tap each (docs/01 §4.9). */
export function DeskActions() {
  return (
    <nav aria-label={t("desk.actions")} className="grid gap-3 sm:grid-cols-3">
      {ACTIONS.map(({ href, title, body, icon: Icon, testId }) => (
        <Link
          key={href}
          href={href}
          data-testid={testId}
          className="flex items-start gap-3 rounded-lg border bg-card p-4 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-col"
        >
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
            <Icon aria-hidden className="size-5" />
          </span>
          <span className="grid gap-0.5">
            <span className="font-medium">{t(title)}</span>
            <span className="text-sm text-muted-foreground">{t(body)}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}

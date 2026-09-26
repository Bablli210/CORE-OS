import { HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import type { CoachClient } from "@gymos/api/coaching/coaching";

/** docs/04 ClientHeader: name, branch, coach, sessions left per coach, at-risk, injuries, unpaid sessions. */
export function ClientHeader({ client: c }: { client: CoachClient }) {
  return (
    <header className="grid gap-2" data-testid="client-header">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold md:text-2xl">{c.full_name}</h1>
        {c.at_risk ? <Badge variant="destructive">{t("today.atRisk")}</Badge> : null}
        {c.unpaid_sessions > 0 ? <Badge variant="warning">{t("clients.unpaid", { n: c.unpaid_sessions })}</Badge> : null}
        {c.status !== "active" ? <Badge variant="outline">{t(c.status === "frozen" ? "client.status.frozen" : "client.status.lapsed")}</Badge> : null}
      </div>
      <p className="text-sm text-muted-foreground">
        {[c.branch_name, c.coach_name && t("client.coach", { name: c.coach_name }), c.membership_ends_at && t("client.membershipUntil", { date: formatDate(c.membership_ends_at) })].filter(Boolean).join(" · ")}
      </p>
      <div className="flex flex-wrap gap-2" data-testid="balances">
        {c.balances.length === 0 ? <Badge variant="destructive">{t("client.noSessions")}</Badge> : null}
        {c.balances.map((b) => (
          <Badge key={b.coach_membership_id} variant={b.balance > 0 ? "secondary" : "destructive"}>
            {t("client.withCoach", { n: b.balance, coach: b.coach_name, date: formatDate(b.next_expiry) })}
          </Badge>
        ))}
      </div>
      {c.injuries ? (
        <p className="flex items-center gap-2 rounded-md border border-warning bg-warning/10 p-2 text-sm"><HeartPulse aria-hidden className="size-4" />{c.injuries}</p>
      ) : null}
    </header>
  );
}

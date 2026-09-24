import { CreditCard } from "lucide-react";
import { EmptyState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import type { ClientCredits } from "../queries/client-credits";

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "Africa/Cairo" });

/** Sessions left per coach (packs are coach-bound) and membership end, for the client's Today. */
export function CreditSummary({ credits }: { credits: ClientCredits }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("credits.title")}</CardTitle>
        {credits.membershipEndsAt ? (
          <p className="text-sm text-muted-foreground">{t("credits.membershipUntil", { date: dateFormat.format(new Date(credits.membershipEndsAt)) })}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {credits.balances.length === 0 ? (
          <EmptyState icon={CreditCard} title={t("credits.none")} body={t("credits.noneBody")} action={{ href: "/c/credits", label: t("credits.renew") }} />
        ) : (
          <ul className="grid gap-2" data-testid="credit-balances">
            {credits.balances.map((b) => (
              <li key={b.coachMembershipId} className="flex items-center justify-between gap-3 rounded-md bg-muted p-3">
                <span className="grid">
                  <span className="font-medium">{t("credits.withCoach", { count: b.balance, coach: b.coachName })}</span>
                  {b.nextExpiry ? (
                    <span className="text-xs text-muted-foreground">{t("credits.expires", { date: dateFormat.format(new Date(b.nextExpiry)) })}</span>
                  ) : null}
                </span>
                {b.balance <= 2 ? <Badge variant="warning">{t("credits.low")}</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

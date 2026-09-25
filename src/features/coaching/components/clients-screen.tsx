"use client";

import { Search, Users } from "lucide-react";
import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOwnCoachMembership } from "@/features/sessions/hooks/use-coach";
import { daysSince, formatDate } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCoachClients } from "../hooks/use-coaching";

/** /coach/clients — my clients, at-risk and lowest adherence first (docs/04). Adherence is the live 30-day figure. */
export function ClientsScreen() {
  const coach = useOwnCoachMembership();
  const { data, isPending, isError, refetch } = useCoachClients(coach);
  const [query, setQuery] = useState("");
  const search = useDeferredValue(query.trim().toLowerCase());
  const rows = (data ?? []).filter((c) => !search || c.full_name.toLowerCase().includes(search));

  return (
    <>
      <PageHeader title={t("clients.title")} description={t("clients.description")} />
      <label className="relative mb-4 block">
        <span className="sr-only">{t("common.search")}</span>
        <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input type="search" className="ps-9" placeholder={t("clients.search")} value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      {!coach ? (
        <EmptyState icon={Users} title={t("schedule.noCoach")} body={t("schedule.noCoachBody")} action={{ href: "/coach", label: t("nav.backToday") }} />
      ) : isPending ? (
        <LoadingList label={t("common.loading")} />
      ) : isError ? (
        <ErrorState title={t("clients.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title={query ? t("clients.noMatch") : t("clients.empty")} body={query ? undefined : t("clients.emptyBody")} action={{ href: "/coach/schedule", label: t("action.openWeek") }} />
      ) : (
        <ul className="grid gap-2" aria-label={t("clients.title")}>
          <li aria-hidden className="hidden px-3 text-xs text-muted-foreground md:grid md:grid-cols-[2fr_1fr_1fr_1fr_1fr]">
            <span>{t("clients.col.client")}</span><span>{t("clients.col.left")}</span><span>{t("clients.col.adherence")}</span><span>{t("clients.col.lastVisit")}</span><span>{t("clients.col.expiry")}</span>
          </li>
          {rows.map((c) => (
            <li key={c.client_id}>
              <Link
                href={`/coach/clients/${c.client_id}`}
                data-testid="client-row"
                className="grid gap-1 rounded-lg border p-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[2fr_1fr_1fr_1fr_1fr] md:items-center"
              >
                <span className="flex flex-wrap items-center gap-1">
                  <span className="font-medium">{c.full_name}</span>
                  {c.at_risk ? <Badge variant="destructive">{t("today.atRisk")}</Badge> : null}
                  {c.unpaid_sessions > 0 ? <Badge variant="warning">{t("clients.unpaid", { n: c.unpaid_sessions })}</Badge> : null}
                  {c.weekly_slots === 0 && c.credits_left > 0 ? <Badge variant="outline">{t("clients.notScheduled")}</Badge> : null}
                </span>
                <span className={cn("text-sm", c.credits_left <= 0 && "font-medium text-destructive")}>{t("today.left", { n: c.credits_left })}</span>
                <span className="text-sm" data-testid="adherence">
                  {c.adherence_pct === null ? t("clients.noData") : t("clients.adherence", { pct: c.adherence_pct, noShows: c.no_shows_30d })}
                </span>
                <span className="text-sm text-muted-foreground">{c.last_visit_at ? t("clients.daysAgo", { n: daysSince(c.last_visit_at) }) : t("clients.never")}</span>
                <span className="text-sm text-muted-foreground">{c.next_expiry ? formatDate(c.next_expiry) : "—"}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

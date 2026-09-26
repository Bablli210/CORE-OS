import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingSummary } from "@/features/leads/components/onboarding-summary";
import type { Json } from "@gymos/api/database.types";
import { formatDate, formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import type { CoachClient } from "@gymos/api/coaching/coaching";

/** Overview: adherence, weekly slots and next session, then the onboarding answers (goals, preferences, health). */
export function OverviewTab({ client: c }: { client: CoachClient }) {
  const a = c.adherence;
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("coachClient.adherence")}</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            <p className="text-2xl font-semibold" data-testid="client-adherence">{a.adherence_pct === null ? "—" : `${a.adherence_pct}%`}</p>
            <p className="text-muted-foreground">{t("coachClient.adherenceLine", { done: a.completed_30d, of: a.scheduled_30d, noShows: a.no_shows_30d })}</p>
            <p className="text-muted-foreground">{c.last_visit_at ? t("coachClient.lastVisit", { date: formatDate(c.last_visit_at) }) : t("clients.never")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("coachClient.week")}</CardTitle></CardHeader>
          <CardContent className="grid gap-1 text-sm">
            {c.slots.length === 0 ? <p className="text-muted-foreground">{t("coachClient.noSlots")}</p> : null}
            <ul className="grid gap-1">
              {c.slots.map((s) => (
                <li key={s.id}>{t("coachClient.slotLine", { day: t(`weekday.${s.weekday}` as MessageKey), time: s.start_time, coach: s.coach_name })}</li>
              ))}
            </ul>
            {c.next_session ? <p className="text-muted-foreground">{t("coachClient.next", { when: formatDateTime(c.next_session.starts_at), coach: c.next_session.coach_name })}</p> : null}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>{t("coachClient.onboarding")}</CardTitle></CardHeader>
        <CardContent>
          <OnboardingSummary responses={c.onboarding as Record<string, Record<string, Json>>} />
        </CardContent>
      </Card>
    </div>
  );
}

/** Logs: the client's recent workouts (sets logged, PRs). Logging itself is the client app (M5). */
export function LogsTab({ client: c }: { client: CoachClient }) {
  if (c.workouts.length === 0) return <p className="text-sm text-muted-foreground">{t("coachClient.noLogs")}</p>;
  return (
    <ul className="grid gap-2">
      {c.workouts.map((w) => (
        <li key={w.id} className="flex justify-between gap-2 rounded-md border p-3 text-sm">
          <span><span className="font-medium">{w.day_name ?? t("coachClient.freeWorkout")}</span> · {formatDate(w.performed_at)}</span>
          <span className="text-muted-foreground">{t("coachClient.setsLine", { sets: w.sets, prs: w.prs })}</span>
        </li>
      ))}
    </ul>
  );
}

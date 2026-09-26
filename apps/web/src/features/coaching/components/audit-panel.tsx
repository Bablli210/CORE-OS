"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useCoachingMutation } from "@gymos/api/coaching/use-coaching";
import { decideApproval, type Team } from "@gymos/api/coaching/coaching";

const outcome = (s: string) => t(`session.status.${s}` as MessageKey);

/** Audit (docs/04 Team): late attendance edits waiting for the head coach, recent waivers and decided edits, unpaid sessions. */
export function AuditPanel({ team, onDone }: { team: Team; onDone: (m: string) => void }) {
  const decide = useCoachingMutation((v: { id: string; approve: boolean }) => decideApproval(v.id, v.approve));
  return (
    <div className="grid gap-5">
      <section className="grid gap-2" aria-label={t("coachTeam.pendingEdits")}>
        <h3 className="text-sm font-semibold">{t("coachTeam.pendingEdits")} ({team.pending_edits.length})</h3>
        {team.pending_edits.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachTeam.noPendingEdits")}</p> : null}
        <ul className="grid gap-2">
          {team.pending_edits.map((e) => (
            <li key={e.approval_id} data-testid="pending-edit" className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span className="grid">
                <span className="font-medium">{e.client_name} · {formatDateTime(e.starts_at)}</span>
                <span className="text-muted-foreground">{t("coachTeam.editLine", { coach: e.coach_name, from: outcome(e.current_status), to: outcome(e.requested_outcome), by: e.requested_by })}{e.waive ? ` · ${t("coachTeam.waive", { reason: e.waive_reason ?? "" })}` : ""}</span>
              </span>
              <span className="flex gap-2">
                <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: e.approval_id, approve: true }, { onSuccess: () => onDone(t("coachTeam.editApproved", { name: e.client_name })) })}>{t("queue.approve")}</Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: e.approval_id, approve: false }, { onSuccess: () => onDone(t("coachTeam.editRejected", { name: e.client_name })) })}>{t("queue.reject")}</Button>
              </span>
            </li>
          ))}
        </ul>
        {decide.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(decide.error))}</p> : null}
      </section>
      <section className="grid gap-2" aria-label={t("coachTeam.waivers")}>
        <h3 className="text-sm font-semibold">{t("coachTeam.waivers")}</h3>
        {team.waivers.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachTeam.noWaivers")}</p> : null}
        <ul className="grid gap-1 text-sm">
          {team.waivers.map((w) => <li key={w.session_id}>{formatDateTime(w.starts_at)} · {w.client_name} · {w.coach_name} — {w.reason}</li>)}
        </ul>
      </section>
      <section className="grid gap-2" aria-label={t("coachTeam.lateEdits")}>
        <h3 className="text-sm font-semibold">{t("coachTeam.lateEdits")}</h3>
        {team.late_edits.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachTeam.noLateEdits")}</p> : null}
        <ul className="grid gap-1 text-sm">
          {team.late_edits.map((e) => (
            <li key={e.approval_id} className="flex flex-wrap gap-2">
              <span>{e.client_name} · {formatDateTime(e.starts_at)} → {outcome(e.outcome)}</span>
              <Badge variant={e.status === "approved" ? "success" : "outline"}>{t(e.status === "approved" ? "coachTeam.approved" : "coachTeam.rejected")}</Badge>
              <span className="text-muted-foreground">{e.requested_by}{e.decided_by ? ` / ${e.decided_by}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-2" aria-label={t("coachTeam.unpaid")}>
        <h3 className="text-sm font-semibold">{t("coachTeam.unpaid")} ({team.unpaid.length})</h3>
        {team.unpaid.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachTeam.noUnpaid")}</p> : null}
        <ul className="grid gap-1 text-sm">
          {team.unpaid.map((u) => <li key={u.session_id}>{formatDateTime(u.starts_at)} · {u.client_name} · {u.coach_name}</li>)}
        </ul>
      </section>
    </div>
  );
}

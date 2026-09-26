"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { useOwnCoachMembership } from "@/features/sessions/hooks/use-coach";
import { addSession } from "@gymos/api/sessions/coach";
import { cairoInstant, cairoToday } from "@gymos/api/sessions/week";
import { formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useCoachingMutation } from "@gymos/api/coaching/use-coaching";
import type { CoachClient } from "@gymos/api/coaching/coaching";

/** Sessions: history with outcomes (unpaid marked), and a one-off outside the weekly schedule (fn_add_session). */
export function SessionsTab({ client: c, onNotice }: { client: CoachClient; onNotice: (m: string) => void }) {
  const coach = useOwnCoachMembership();
  const [adding, setAdding] = useState(false);
  return (
    <div className="grid gap-3">
      {coach ? <Button variant="outline" className="w-full md:w-auto md:justify-self-start" onClick={() => setAdding(true)}>{t("coachClient.addOneOff")}</Button> : null}
      {c.sessions.length === 0 ? <p className="text-sm text-muted-foreground">{t("coachClient.noSessions")}</p> : null}
      <ul className="grid gap-2">
        {c.sessions.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm" data-testid="history-row">
            <span className="grid">
              <span className="font-medium">{formatDateTime(s.starts_at)}</span>
              <span className="text-muted-foreground">{s.coach_name}{s.is_walk_in ? ` · ${t("today.walkIn")}` : ""}</span>
            </span>
            <span className="flex flex-wrap gap-1">
              <Badge variant={s.status === "completed" ? "success" : s.status === "no_show" ? "warning" : "outline"}>{t(`session.status.${s.status}` as MessageKey)}</Badge>
              {s.unpaid && !s.settled_at ? <Badge variant="destructive">{t("today.unpaid")}</Badge> : null}
              {s.settled_at ? <Badge variant="outline">{t("coachClient.settled")}</Badge> : null}
              {s.waived ? <Badge variant="outline">{t("today.waived")}</Badge> : null}
            </span>
          </li>
        ))}
      </ul>
      {adding && coach ? <OneOffSheet clientId={c.id} coach={coach} onClose={() => setAdding(false)} onDone={() => { setAdding(false); onNotice(t("coachClient.oneOffAdded")); }} /> : null}
    </div>
  );
}

function OneOffSheet({ clientId, coach, onClose, onDone }: { clientId: string; coach: string; onClose: () => void; onDone: () => void }) {
  const [date, setDate] = useState(cairoToday());
  const [time, setTime] = useState("08:00");
  const add = useCoachingMutation(() => addSession(clientId, coach, cairoInstant(date, time)));
  return (
    <Sheet open onClose={onClose} title={t("coachClient.addOneOff")} closeLabel={t("common.close")}>
      <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); add.mutate(undefined, { onSuccess: onDone }); }}>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("coachClient.date")} htmlFor="oneoff-date"><Input id="oneoff-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label={t("schedule.start")} htmlFor="oneoff-time"><Input id="oneoff-time" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <p className="text-sm text-muted-foreground">{t("coachClient.oneOffHint")}</p>
        {add.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(add.error))}</p> : null}
        <Button type="submit" size="block" disabled={!date || !time || add.isPending}>{t("coachClient.addOneOff")}</Button>
      </form>
    </Sheet>
  );
}

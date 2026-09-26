"use client";

import { useQuery } from "@tanstack/react-query";
import { CloudOff, PartyPopper, Trophy } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { useOutbox } from "../hooks/use-outbox";
import { clientKeys, fetchWorkoutSets } from "../queries/client";

/**
 * After Finish (?done=<workout id>): waiting on the phone until it is sent, then the sets as saved, with the PR badge the
 * database put on every set that beat the client's history.
 */
export function WorkoutSummary({ workoutId, onAnother }: { workoutId: string; onAnother: () => void }) {
  const { items, online, retry } = useOutbox();
  const queued = items.find((i) => i.key === workoutId);
  const sets = useQuery({ queryKey: clientKeys.workout(workoutId), queryFn: () => fetchWorkoutSets(workoutId), enabled: !queued });
  const prs = (sets.data ?? []).filter((s) => s.is_pr).length;

  return (
    <section className="grid gap-4" data-testid="workout-summary" data-synced={!queued && !!sets.data}>
      {queued?.error ? (
        <div role="alert" className="grid gap-2 rounded-lg border border-destructive p-4">
          <p className="font-medium">{t("workout.refused")}</p>
          <p className="text-sm text-muted-foreground">{queued.error}</p>
        </div>
      ) : queued ? (
        <div role="status" className="grid gap-2 rounded-lg border border-warning bg-warning/10 p-4">
          <p className="flex items-center gap-2 font-medium"><CloudOff aria-hidden className="size-5" />{t("workout.savedOnPhone")}</p>
          <p className="text-sm text-muted-foreground">{online ? t("workout.sending") : t("workout.willSync")}</p>
          {online ? <Button size="sm" variant="outline" className="justify-self-start" onClick={() => void retry()}>{t("common.retry")}</Button> : null}
        </div>
      ) : (
        <div role="status" className="grid gap-1 rounded-lg border border-success bg-success/10 p-4">
          <p className="flex items-center gap-2 font-medium"><PartyPopper aria-hidden className="size-5" />{t("workout.saved")}</p>
          {prs ? <p className="text-sm">{t("workout.prCount", { n: prs })}</p> : null}
        </div>
      )}
      {sets.data?.length ? (
        <ul className="grid gap-1" aria-label={t("workout.setsSaved")}>
          {sets.data.map((s) => (
            <li key={s.id} data-testid="saved-set" data-pr={s.is_pr} className="flex items-center justify-between gap-2 rounded-md border p-2 text-sm">
              <span>{s.exercises?.name} · {t("workout.setLine", { n: s.set_index, kg: s.weight_kg ?? "–", reps: s.reps ?? "–" })}</span>
              {s.is_pr ? <Badge variant="success"><Trophy aria-hidden className="me-1 size-3" />{t("workout.pr")}</Badge> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid gap-2 md:flex">
        <Link href="/c/progress" className={buttonVariants({ variant: "outline" })}>{t("workout.seeProgress")}</Link>
        <Button variant="ghost" onClick={onAnother}>{t("workout.another")}</Button>
      </div>
    </section>
  );
}

import { t } from "@/lib/i18n";
import type { ProgramDay } from "../queries/programs";

/** A program as the client sees it: each day, its exercises with sets × reps, rest and target; supersets marked. */
export function ProgramPreview({ days }: { days: ProgramDay[] }) {
  if (days.length === 0) return <p className="text-sm text-muted-foreground">{t("program.noDays")}</p>;
  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="program-preview">
      {days.map((d, i) => (
        <section key={d.id ?? i} className="grid content-start gap-2 rounded-lg border p-3">
          <h3 className="font-semibold">{d.name}</h3>
          <ol className="grid gap-2">
            {d.exercises.map((e, j) => (
              <li key={`${e.exercise_id}-${j}`} className="flex items-start justify-between gap-2 text-sm">
                <span>
                  {e.superset_group ? <span className="me-1 rounded bg-muted px-1 text-xs font-medium">{e.superset_group}</span> : null}
                  {e.exercise_name}
                  {e.notes ? <span className="block text-xs text-muted-foreground">{e.notes}</span> : null}
                </span>
                <span className="whitespace-nowrap text-muted-foreground">
                  {t("program.setsReps", { sets: e.sets, reps: e.reps })}
                  {e.target_weight_kg ? ` · ${e.target_weight_kg} kg` : ""}
                  {e.rest_seconds ? ` · ${t("program.restShort", { s: e.rest_seconds })}` : ""}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

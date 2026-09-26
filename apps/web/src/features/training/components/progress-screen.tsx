"use client";

import { Flame, Trophy } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { formatDate } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { useOutbox } from "@gymos/api/training/use-outbox";
import { useHome, useProgress } from "@gymos/api/training/use-client";
import { TrendChart } from "./trend-chart";

/** /c/progress — see that it's working (docs/04): streak, PRs, one exercise's top set over time, body weight (+ add). */
export function ProgressScreen() {
  const [exercise, setExercise] = useState<string | null>(null);
  const progress = useProgress(exercise);
  const home = useHome();
  const { push, items } = useOutbox();
  const [weight, setWeight] = useState("");
  const [saved, setSaved] = useState("");

  if (progress.isPending) return <LoadingList label={t("common.loading")} />;
  if (progress.isError || !progress.data) return <ErrorState title={t("progress.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => progress.refetch()}>{t("common.retry")}</Button>} />;
  const p = progress.data;
  const current = p.prs.find((x) => x.exercise_id === p.exercise_id);
  const pendingBody = items.filter((i) => i.kind === "body").length;

  const addWeight = async () => {
    const kg = Number(weight.replace(",", "."));
    if (!home.data || !(kg > 20 && kg < 400)) return;
    const id = crypto.randomUUID();
    await push({ key: id, kind: "body", createdAt: new Date().toISOString(), row: { id, client_id: home.data.client_id, measured_at: new Date().toISOString(), weight_kg: kg } });
    setWeight("");
    setSaved(t("progress.weightSaved", { kg }));
  };

  return (
    <div className="grid max-w-2xl gap-4">
      <PageHeader title={t("progress.title")} />
      <div className="grid grid-cols-2 gap-3">
        <Card><CardContent className="grid gap-1 p-4"><span className="flex items-center gap-1 text-sm text-muted-foreground"><Flame aria-hidden className="size-4" />{t("progress.streak")}</span><span className="text-2xl font-semibold" data-testid="streak">{t("progress.weeks", { n: p.streak_weeks })}</span></CardContent></Card>
        <Card><CardContent className="grid gap-1 p-4"><span className="text-sm text-muted-foreground">{t("progress.workouts30")}</span><span className="text-2xl font-semibold">{p.workouts_30d}</span></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy aria-hidden className="size-4" />{t("progress.prs")}</CardTitle></CardHeader>
        <CardContent>
          {p.prs.length === 0 ? <p className="text-sm text-muted-foreground">{t("progress.noPrs")}</p> : (
            <ul className="grid gap-1 text-sm" data-testid="pr-list">
              {p.prs.map((x) => (
                <li key={x.exercise_id} className="flex justify-between gap-2">
                  <span>{x.exercise_name}</span>
                  <span className="text-muted-foreground">{t("progress.prLine", { kg: x.weight_kg, reps: x.reps, date: formatDate(x.performed_at) })}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {p.prs.length ? (
        <Card>
          <CardHeader className="gap-2">
            <CardTitle>{t("progress.topSet", { name: current?.exercise_name ?? "" })}</CardTitle>
            <label><span className="sr-only">{t("progress.exercise")}</span>
              <Select value={p.exercise_id ?? ""} onChange={(e) => setExercise(e.target.value)}>
                {p.prs.map((x) => <option key={x.exercise_id} value={x.exercise_id}>{x.exercise_name}</option>)}
              </Select>
            </label>
          </CardHeader>
          <CardContent><TrendChart points={p.series.map((s) => ({ date: s.date, value: Number(s.top_kg) }))} unit="kg" name={t("progress.topSetShort")} /></CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t("progress.bodyWeight")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {p.body.length ? <TrendChart points={p.body.map((b) => ({ date: b.measured_at, value: Number(b.weight_kg) }))} unit="kg" name={t("progress.bodyWeight")} /> : <p className="text-sm text-muted-foreground">{t("progress.noWeight")}</p>}
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addWeight(); }}>
            <label className="flex-1"><span className="sr-only">{t("progress.weightKg")}</span>
              <Input inputMode="decimal" placeholder={t("progress.weightKg")} value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <Button type="submit" disabled={!weight}>{t("progress.addWeight")}</Button>
          </form>
          <p role="status" className="text-sm text-success">{saved}{pendingBody ? <Badge variant="outline" className="ms-2">{t("progress.waiting", { n: pendingBody })}</Badge> : null}</p>
        </CardContent>
      </Card>
    </div>
  );
}

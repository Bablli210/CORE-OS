import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useTraining } from "@gymos/api/training/use-client";
import { useOutbox } from "@gymos/api/training/use-outbox";
import { useWorkoutDraft } from "@gymos/api/training/use-workout-draft";
import { doneSets, toRows } from "@gymos/api/training/workout-draft";
import { t } from "@gymos/i18n";
import { ExerciseBlock } from "@/features/client/exercise-block";
import { newId } from "@/lib/ids";
import { space } from "@/theme";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { Empty, Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/**
 * Log today's workout (docs/04 /c/workout) on the phone. Works without signal: the program comes from the phone's copy,
 * the workout in progress is saved on the phone, and Finish queues it in the outbox — sent now, or when signal returns,
 * with ids made on the phone so a resend never doubles it (the web's outbox and draft, shared).
 */
export default function Workout() {
  const training = useTraining();
  const { push, online, items } = useOutbox();
  const data = training.data;
  const program = data?.program ?? null;
  const days = program?.days ?? [];
  const [picked, setPicked] = useState<number | null>(null);
  const dayIndex = Math.min(Math.max(1, picked ?? data?.next_day_index ?? 1), Math.max(1, days.length));
  const day = days[dayIndex - 1];
  const { draft, update, reset } = useWorkoutDraft(program?.id ?? null, dayIndex, day, data?.history ?? {});
  const [saving, setSaving] = useState(false);
  const [finished, setFinished] = useState<string | null>(null);

  if (training.isPending) return <Loading />;
  if (training.isError || !data) return <Screen title={t("workout.title")}><Failed title={t("workout.error")} onRetry={() => void training.refetch()} /></Screen>;
  if (!program || days.length === 0) return <Screen title={t("workout.title")}><Empty title={t("myProgram.none")} body={t("myProgram.noneBody")} /></Screen>;

  const count = draft ? doneSets(draft) : 0;
  const waiting = items.filter((i) => !i.error).length;
  const finish = async () => {
    if (!draft) return;
    setSaving(true);
    const rows = toRows(draft, data.client_id, newId);
    await push({ key: rows.workout.id, kind: "workout", createdAt: rows.workout.performed_at, workout: rows.workout, sets: rows.sets });
    await reset();
    setSaving(false);
    setFinished(rows.workout.id);
  };
  const synced = finished !== null && !items.some((i) => i.key === finished);

  return (
    <Screen
      testID="client-workout"
      title={t("workout.title")}
      subtitle={program.name}
      footer={finished ? <Button block label={t("mobile.anotherWorkout")} variant="outline" onPress={() => setFinished(null)} /> : <Button block label={t("workout.finish", { n: count })} disabled={count === 0} busy={saving} onPress={() => void finish()} />}
    >
      {!online || data.fromCache ? <Text variant="info" accessibilityRole="alert" testID="offline-banner">{t("workout.offline")}</Text> : null}
      {finished ? (
        <View testID="workout-finished" style={{ gap: space[2] }}>
          <Text variant="heading">{synced ? t("mobile.workoutSynced") : t("workout.savedOnPhone")}</Text>
          {!synced ? <Text variant="muted">{t("mobile.outboxWaiting", { n: waiting })}</Text> : null}
        </View>
      ) : (
        <>
          <ScrollView horizontal accessibilityRole="tablist" contentContainerStyle={{ gap: space[2] }}>
            {days.map((d, i) => (
              <Button key={d.id ?? i} label={`${d.name}${i + 1 === data.next_day_index ? ` · ${t("workout.next")}` : ""}`} accessibilityRole="tab" selected={i + 1 === dayIndex} variant={i + 1 === dayIndex ? "primary" : "outline"} onPress={() => setPicked(i + 1)} />
            ))}
          </ScrollView>
          {draft && day ? day.exercises.map((e, i) => (
            <ExerciseBlock key={`${e.id ?? e.exercise_id}-${i}`} exercise={e} draft={draft.exercises[i]} last={data.history[e.exercise_id]}
              onChange={(sets) => update((d) => ({ ...d, exercises: d.exercises.map((x, j) => (j === i ? { ...x, sets } : x)) }))} />
          )) : <Loading />}
        </>
      )}
    </Screen>
  );
}

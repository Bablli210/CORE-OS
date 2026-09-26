import { TextInput, View } from "react-native";
import { formatDate } from "@gymos/api/format";
import type { ProgramExercise } from "@gymos/api/programs/programs";
import type { LastTime } from "@gymos/api/training/client";
import type { DraftExercise, DraftSet } from "@gymos/api/training/workout-draft";
import { t } from "@gymos/i18n";
import { radius, space, TAP, useColors } from "@/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Text } from "@/ui/text";

/** One exercise: target, last time, and a row per set (kg, reps, Done), prefilled from last time (same draft as the web). */
export function ExerciseBlock({ exercise: e, draft, last, onChange }: { exercise: ProgramExercise; draft: DraftExercise; last: LastTime | undefined; onChange: (sets: DraftSet[]) => void }) {
  const c = useColors();
  const set = (i: number, patch: Partial<DraftSet>) => onChange(draft.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const done = draft.sets.filter((s) => s.done).length;
  const input = { minHeight: TAP, flex: 1, flexBasis: 0, minWidth: 0, borderWidth: 1, borderColor: c.input, borderRadius: radius.md, paddingHorizontal: space[2], color: c.foreground, fontSize: 16 } as const;
  return (
    <Card testID="exercise-card">
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{e.exercise_name}</Text>
          <Text variant="muted">{t("program.setsReps", { sets: e.sets, reps: e.reps })}{e.target_weight_kg ? ` · ${e.target_weight_kg} kg` : ""}</Text>
        </View>
        <Badge label={`${done}/${draft.sets.length}`} tone={done === draft.sets.length ? "success" : "outline"} />
      </View>
      <Text variant="small">
        {last?.sets?.length ? t("workout.lastTime", { date: formatDate(last.performed_at), sets: last.sets.map((s) => `${s.weight_kg ?? "–"}×${s.reps ?? "–"}`).join(", ") }) : t("workout.firstTime")}
      </Text>
      {draft.sets.map((s, i) => (
        <View key={i} testID="set-row" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Text variant="muted" style={{ width: 20 }}>{i + 1}</Text>
          <TextInput style={input} accessibilityLabel={t("workout.kgFor", { n: i + 1, name: e.exercise_name })} keyboardType="decimal-pad" value={s.weight} placeholder="kg" placeholderTextColor={c.mutedForeground} onChangeText={(v) => set(i, { weight: v })} />
          <TextInput style={input} accessibilityLabel={t("workout.repsFor", { n: i + 1, name: e.exercise_name })} keyboardType="number-pad" value={s.reps} placeholder={t("program.reps")} placeholderTextColor={c.mutedForeground} onChangeText={(v) => set(i, { reps: v })} />
          <Button label="✓" variant={s.done ? "success" : "outline"} selected={s.done} aria-pressed={s.done} accessibilityLabel={t("workout.doneFor", { n: i + 1, name: e.exercise_name })} style={{ width: TAP, paddingHorizontal: 0 }} onPress={() => set(i, { done: !s.done })} />
        </View>
      ))}
    </Card>
  );
}

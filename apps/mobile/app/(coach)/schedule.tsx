import { useState } from "react";
import { View } from "react-native";
import { useWeek } from "@gymos/api/sessions/use-coach-data";
import { addDays, cairoToday, dateInWeek, WEEK_ORDER, weekStart } from "@gymos/api/sessions/week";
import { formatDate } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { useMembership } from "@/auth/session";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Empty, Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/**
 * The coach's week (fn_coach_week), day by day from Saturday: client slots with sessions left, classes and blocked time.
 * Read-only on the phone: slots are added and moved on the web's week grid (mobile v1 scope).
 */
export default function Schedule() {
  const coach = useMembership()?.id ?? null;
  const [start, setStart] = useState(weekStart(cairoToday()));
  const week = useWeek(coach, start);
  return (
    <Screen title={t("nav.schedule")} subtitle={t("mobile.weekOf", { date: formatDate(`${start}T12:00:00Z`) })} onRefresh={() => void week.refetch()} refreshing={week.isRefetching} testID="coach-schedule">
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Button label={t("mobile.prevWeek")} variant="ghost" onPress={() => setStart(addDays(start, -7))} />
        <Button label={t("mobile.nextWeek")} variant="ghost" onPress={() => setStart(addDays(start, 7))} />
      </View>
      {week.isPending ? <Loading /> : week.isError || !week.data ? <Failed title={t("today.error.load")} onRetry={() => void week.refetch()} /> : week.data.slots.length === 0 ? (
        <Empty title={t("mobile.weekEmpty")} body={t("mobile.weekEmptyBody")} />
      ) : (
        WEEK_ORDER.map((wd) => {
          const date = dateInWeek(start, wd);
          const slots = week.data.slots.filter((s) => s.weekday === wd).sort((a, b) => a.start_time.localeCompare(b.start_time));
          return (
            <Card key={wd} testID="schedule-day">
              <Text variant="heading">{t(`weekday.${wd}` as MessageKey)} · {formatDate(`${date}T12:00:00Z`)}</Text>
              {slots.length === 0 ? <Text variant="muted">{t("mobile.dayFree")}</Text> : slots.map((s) => (
                <View key={s.id} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space[2] }} testID="schedule-slot">
                  <Text style={{ flex: 1 }}>{s.start_time.slice(0, 5)} · {s.kind === "client" ? s.client_name : s.label ?? t(`mobile.slot.${s.kind}` as MessageKey)}</Text>
                  {s.skipped.includes(date) ? <Badge label={t("mobile.skipped")} tone="outline" /> : s.kind === "client" && s.credits_left !== null ? (
                    <Badge label={t("today.left", { n: s.credits_left })} tone={s.credits_left > 0 ? "neutral" : "destructive"} />
                  ) : null}
                </View>
              ))}
            </Card>
          );
        })
      )}
    </Screen>
  );
}

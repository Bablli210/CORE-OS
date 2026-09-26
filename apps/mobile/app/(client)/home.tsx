import { router } from "expo-router";
import { View } from "react-native";
import { formatDate, formatDateTime } from "@gymos/api/format";
import { useHome } from "@gymos/api/training/use-client";
import { useOutbox } from "@gymos/api/training/use-outbox";
import { t, type MessageKey } from "@gymos/i18n";
import { useSession } from "@/auth/session";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/** The member's Today (fn_client_home): next session, sessions left per coach, the coach's slots (read-only), the program. */
export default function Home() {
  const home = useHome();
  const { items } = useOutbox();
  const { signOut } = useSession();
  const d = home.data;
  const waiting = items.filter((i) => !i.error).length;
  return (
    <Screen
      testID="client-home"
      title={d ? t("mobile.hello", { name: d.first_name }) : t("nav.today")}
      onRefresh={() => void home.refetch()}
      refreshing={home.isRefetching}
      footer={d?.program ? <Button block label={t("home.startWorkout")} onPress={() => router.push("/workout")} /> : undefined}
    >
      {home.isPending ? <Loading /> : home.isError || !d ? <Failed title={t("mobile.homeError")} onRetry={() => void home.refetch()} /> : (
        <View style={{ gap: space[3] }}>
          {d.fromCache ? <Text variant="info" accessibilityRole="alert">{t("home.cached")}</Text> : null}
          {waiting ? <Text variant="info" testID="outbox-waiting">{t("mobile.outboxWaiting", { n: waiting })}</Text> : null}
          <Card>
            <Text variant="heading">{t("home.next")}</Text>
            <Text>{d.next_session ? t("home.nextLine", { when: formatDateTime(d.next_session.starts_at), coach: d.next_session.coach_name, branch: d.next_session.branch_name }) : t("home.noSession")}</Text>
          </Card>
          <Card testID="client-balances">
            <Text variant="heading">{t("credits.title")}</Text>
            {d.balances.length === 0 ? <Text variant="muted">{t("mobile.noCredits")}</Text> : d.balances.map((b) => (
              <View key={b.coach_membership_id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <Text>{b.coach_name}</Text>
                <Badge label={t("today.left", { n: b.balance })} tone={b.balance > 2 ? "neutral" : b.balance > 0 ? "warning" : "destructive"} />
              </View>
            ))}
            {d.membership_ends_at ? <Text variant="muted">{t("mobile.membershipUntil", { date: formatDate(d.membership_ends_at) })}</Text> : null}
          </Card>
          <Card>
            <Text variant="heading">{t("home.yourWeek")}</Text>
            {d.slots.length === 0 ? <Text variant="muted">{t("home.noSlots")}</Text> : d.slots.map((s, i) => (
              <Text key={i}>{t("home.slotLine", { day: t(`weekday.${s.weekday}` as MessageKey), time: s.start_time.slice(0, 5), coach: s.coach_name })}</Text>
            ))}
            <Text variant="small">{t("home.yourWeekHint")}</Text>
          </Card>
          {d.program ? (
            <Card>
              <Text variant="heading">{d.program.name}</Text>
              <Text variant="muted">{t("home.thisWeek", { n: d.workouts_this_week })}</Text>
            </Card>
          ) : <Card><Text variant="heading">{t("myProgram.none")}</Text><Text variant="muted">{t("myProgram.noneBody")}</Text></Card>}
          <Button label={t("shell.signOut")} variant="ghost" onPress={() => void signOut()} />
        </View>
      )}
    </Screen>
  );
}

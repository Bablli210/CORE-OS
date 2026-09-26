import { useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { coachingKeys, fetchCoachClient } from "@gymos/api/coaching/coaching";
import { formatDate, formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/** One client for the coach (fn_coach_client): sessions left, adherence, injuries, weekly slots, next session, notes. */
export default function ClientDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useQuery({ queryKey: coachingKeys.client(id), queryFn: () => fetchCoachClient(id), enabled: !!id });
  if (c.isPending) return <Loading />;
  if (c.isError || !c.data) return <Screen title={t("clients.title")}><Failed title={t("clients.error")} onRetry={() => void c.refetch()} /></Screen>;
  const d = c.data;
  return (
    <Screen title={d.full_name} subtitle={[d.branch_name, d.coach_name].filter(Boolean).join(" · ")} footer={<Button block variant="outline" label={t("mobile.back")} onPress={() => router.back()} />} testID="coach-client">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
        {d.balances.map((b) => <Badge key={b.coach_membership_id} label={`${b.coach_name}: ${t("today.left", { n: b.balance })}`} tone={b.balance > 0 ? "neutral" : "destructive"} />)}
        {d.at_risk ? <Badge label={t("today.atRisk")} tone="warning" /> : null}
        {d.unpaid_sessions ? <Badge label={t("clients.unpaid", { n: d.unpaid_sessions })} tone="destructive" /> : null}
      </View>
      <Card>
        <Text variant="heading">{t("mobile.adherence")}</Text>
        <Text>{d.adherence.adherence_pct === null ? t("clients.noData") : t("clients.adherence", { pct: d.adherence.adherence_pct, noShows: d.adherence.no_shows_30d })}</Text>
        {d.injuries ? <Text variant="error">{t("today.injury")}: {d.injuries}</Text> : null}
      </Card>
      <Card>
        <Text variant="heading">{t("home.next")}</Text>
        <Text>{d.next_session ? formatDateTime(d.next_session.starts_at) : t("home.noSession")}</Text>
        {d.slots.map((s) => <Text key={s.id} variant="muted">{t(`weekday.${s.weekday}` as MessageKey)} {s.start_time.slice(0, 5)} · {s.coach_name}</Text>)}
      </Card>
      {d.notes.length ? (
        <Card>
          <Text variant="heading">{t("mobile.notes")}</Text>
          {d.notes.slice(0, 5).map((n) => <Text key={n.id} variant="muted">{formatDate(n.created_at)} · {n.author}: {n.body}</Text>)}
        </Card>
      ) : null}
    </Screen>
  );
}

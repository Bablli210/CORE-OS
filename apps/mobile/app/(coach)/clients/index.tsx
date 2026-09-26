import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { coachingKeys, fetchCoachClients } from "@gymos/api/coaching/coaching";
import { t } from "@gymos/i18n";
import { useMembership } from "@/auth/session";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Field } from "@/ui/field";
import { Screen } from "@/ui/screen";
import { Empty, Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/** The coach's clients (fn_coach_clients: live 30-day adherence), at-risk and lowest adherence first, with a search. */
export default function Clients() {
  const coach = useMembership()?.id ?? null;
  const [search, setSearch] = useState("");
  const list = useQuery({ queryKey: coachingKeys.clients(coach ?? ""), queryFn: () => fetchCoachClients(coach!), enabled: !!coach });
  const rows = (list.data ?? [])
    .filter((c) => c.full_name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => Number(b.at_risk) - Number(a.at_risk) || (a.adherence_pct ?? 101) - (b.adherence_pct ?? 101));
  return (
    <Screen title={t("clients.title")} subtitle={t("clients.description")} onRefresh={() => void list.refetch()} refreshing={list.isRefetching} testID="coach-clients">
      <Field label={t("clients.search")} value={search} onChangeText={setSearch} autoCapitalize="none" />
      {list.isPending ? <Loading /> : list.isError ? <Failed title={t("clients.error")} onRetry={() => void list.refetch()} /> : rows.length === 0 ? (
        <Empty title={search ? t("clients.noMatch") : t("clients.empty")} body={search ? undefined : t("clients.emptyBody")} />
      ) : (
        <View style={{ gap: space[2] }}>
          {rows.map((c) => (
            <Pressable key={c.client_id} accessibilityRole="link" accessibilityLabel={c.full_name} onPress={() => router.push(`/clients/${c.client_id}`)} testID="client-row">
              <Card>
                <Text variant="heading">{c.full_name}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
                  <Badge label={t("today.left", { n: c.credits_left })} tone={c.credits_left > 0 ? "neutral" : "destructive"} />
                  {c.at_risk ? <Badge label={t("today.atRisk")} tone="warning" /> : null}
                </View>
                <Text variant="muted">{c.adherence_pct === null ? t("clients.noData") : t("clients.adherence", { pct: c.adherence_pct, noShows: c.no_shows_30d })}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

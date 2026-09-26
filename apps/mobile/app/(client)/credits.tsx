import { View } from "react-native";
import { formatDate } from "@gymos/api/format";
import { useCredits } from "@gymos/api/training/use-client";
import { t } from "@gymos/i18n";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Card } from "@/ui/card";
import { Screen } from "@/ui/screen";
import { Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/** Sessions left per coach with the next expiry, the packs and the memberships (fn_client_credits). Renewals: ask the advisor. */
export default function Credits() {
  const c = useCredits();
  const d = c.data;
  return (
    <Screen title={t("nav.credits")} onRefresh={() => void c.refetch()} refreshing={c.isRefetching} testID="client-credits">
      {c.isPending ? <Loading /> : c.isError || !d ? <Failed title={t("mobile.creditsError")} onRetry={() => void c.refetch()} /> : (
        <View style={{ gap: space[3] }}>
          {d.balances.map((b) => (
            <Card key={b.coach_membership_id} testID="credit-balance">
              <Text variant="heading">{b.coach_name}</Text>
              <Text style={{ fontSize: 28, fontWeight: "700" }}>{b.balance}</Text>
              {b.next_expiry ? <Text variant="muted">{t("mobile.nextExpiry", { date: formatDate(b.next_expiry) })}</Text> : null}
            </Card>
          ))}
          <Card>
            <Text variant="heading">{t("mobile.packs")}</Text>
            {d.lots.map((l) => (
              <View key={l.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: space[2] }}>
                <Text style={{ flex: 1 }}>{t("client.lotLine", { remaining: l.qty_remaining, issued: l.qty_issued, coach: l.coach_name })}</Text>
                <Badge label={t(`lot.status.${l.status}`)} tone={l.status === "active" ? "success" : "outline"} />
              </View>
            ))}
          </Card>
          {d.memberships.length ? (
            <Card>
              <Text variant="heading">{t("client.memberships")}</Text>
              {d.memberships.map((m) => <Text key={m.id}>{m.product_name ?? m.type} · {formatDate(m.starts_at)} → {formatDate(m.ends_at)}</Text>)}
            </Card>
          ) : null}
          {d.advisor ? <Text variant="muted">{t("mobile.renewWith", { name: d.advisor.first_name })}</Text> : null}
        </View>
      )}
    </Screen>
  );
}

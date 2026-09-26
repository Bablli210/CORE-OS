import { View } from "react-native";
import { formatTime } from "@gymos/api/format";
import type { DaySession, Outcome } from "@gymos/api/sessions/coach";
import { t } from "@gymos/i18n";
import { space } from "@/theme";
import { Badge } from "@/ui/badge";
import { Button } from "@/ui/button";
import { Card } from "@/ui/card";
import { Text } from "@/ui/text";

const OUTCOMES: { o: Outcome; variant: "success" | "warning" | "neutral" }[] = [
  { o: "completed", variant: "success" },
  { o: "no_show", variant: "warning" },
  { o: "cancelled", variant: "neutral" },
];

/** One session on the coach's day: who, when, sessions left with me, flags; one tap per outcome (same as the web row). */
export function SessionCard({ session: s, canRecord, queued, onOutcome }: { session: DaySession; canRecord: boolean; queued: boolean; onOutcome: (s: DaySession, o: Outcome) => void }) {
  return (
    // dataSet → data-status on the web build (react-native-web); ignored on iOS/Android
    <Card testID="session-row" {...({ dataSet: { status: s.status, id: s.id } } as object)}>
      <Text variant="muted">{formatTime(s.starts_at)} · {t("schedule.minutes", { n: s.duration_minutes })}{s.is_walk_in ? ` · ${t("today.walkIn")}` : ""}</Text>
      <Text variant="heading">{s.client_name}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[1] }}>
        <Badge testID="credits-left" label={t("today.left", { n: s.credits_left })} tone={s.credits_left > 0 ? "neutral" : "destructive"} />
        {s.unpaid ? <Badge label={t("today.unpaid")} tone="destructive" /> : null}
        {s.injuries ? <Badge label={t("today.injury")} tone="warning" /> : null}
        {s.at_risk ? <Badge label={t("today.atRisk")} tone="outline" /> : null}
        {s.pending_approval ? <Badge label={t("today.pendingApproval")} tone="warning" /> : null}
        {queued ? <Badge testID="queued" label={t("today.queued")} tone="outline" /> : null}
      </View>
      {s.injuries ? <Text variant="small">{s.injuries}</Text> : null}
      {canRecord ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={t("today.outcomeFor", { name: s.client_name })} style={{ flexDirection: "row", gap: space[2] }}>
          {OUTCOMES.map(({ o, variant }) => (
            <Button
              key={o}
              label={t(`today.outcome.${o}`)}
              variant={s.status === o ? variant : "outline"}
              selected={s.status === o}
              accessibilityRole="radio"
              aria-checked={s.status === o}
              disabled={s.pending_approval}
              style={{ flex: 1, paddingHorizontal: space[1] }}
              onPress={() => s.status !== o && onOutcome(s, o)}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

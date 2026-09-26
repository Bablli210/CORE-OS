import { useState } from "react";
import { View } from "react-native";
import { formatDate } from "@gymos/api/format";
import { withQueued } from "@gymos/api/sessions/outcome-queue";
import type { DaySession, Outcome } from "@gymos/api/sessions/coach";
import { useDay } from "@gymos/api/sessions/use-coach-data";
import { useOutcomes } from "@gymos/api/sessions/use-outcomes";
import { addDays, cairoToday } from "@gymos/api/sessions/week";
import { t } from "@gymos/i18n";
import { useMembership, useSession } from "@/auth/session";
import { SessionCard } from "@/features/coach/session-card";
import { WalkInSheet } from "@/features/coach/walk-in-sheet";
import { space, useColors } from "@/theme";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { Sheet } from "@/ui/sheet";
import { Empty, Failed, Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/**
 * The coach's day (docs/04 Today) on the phone: one tap per outcome, applied at once and rolled back if the database
 * refuses; with no signal the tap waits on the phone and is sent when signal returns (the web's hook, shared).
 */
export default function Today() {
  const c = useColors();
  const coach = useMembership()?.id ?? null;
  const { signOut } = useSession();
  const today = cairoToday();
  const [date, setDate] = useState(today);
  const day = useDay(coach, date);
  const { record, queue, message, retryNow } = useOutcomes(coach, date);
  const [confirm, setConfirm] = useState<DaySession | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [status, setStatus] = useState("");

  const shown = day.data ? withQueued(day.data, queue) : null;
  const queuedIds = new Set(queue.filter((q) => q.coach === coach).map((q) => q.sessionId));
  const canRecord = !!shown?.can_record && date <= today;
  const onOutcome = (s: DaySession, o: Outcome) => {
    if (o === "completed" && s.credits_left <= 0 && !s.credit_consumed && !s.unpaid) setConfirm(s);
    else void record(s.id, o);
  };

  return (
    <Screen
      testID="coach-today"
      title={date === today ? t("today.title") : formatDate(`${date}T12:00:00Z`)}
      subtitle={shown ? t("today.summary", { n: shown.sessions.length, done: shown.sessions.filter((s) => s.status !== "booked").length }) : undefined}
      onRefresh={() => void day.refetch()}
      refreshing={day.isRefetching}
      footer={date === today ? <Button block label={t("mobile.walkIn")} onPress={() => setWalkIn(true)} /> : undefined}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Button label="‹" variant="ghost" accessibilityLabel={t("today.prevDay")} onPress={() => setDate(addDays(date, -1))} />
        {date !== today ? <Button label={t("today.backToToday")} variant="ghost" onPress={() => setDate(today)} /> : <Text variant="muted">{formatDate(`${date}T12:00:00Z`)}</Text>}
        <Button label="›" variant="ghost" accessibilityLabel={t("today.nextDay")} onPress={() => setDate(addDays(date, 1))} />
      </View>
      {queue.length ? (
        <View testID="queue-banner" accessibilityRole="alert" style={{ borderWidth: 1, borderColor: c.warning, borderRadius: 8, padding: space[3], gap: space[2] }}>
          <Text>{t("today.queueBanner", { n: queue.length })}</Text>
          <Button label={t("common.retry")} variant="outline" onPress={() => void retryNow()} />
        </View>
      ) : null}
      {message ? <Text variant={message.tone === "error" ? "error" : "info"} accessibilityRole="alert">{message.text}</Text> : null}
      {status ? <Text variant="success" accessibilityLiveRegion="polite">{status}</Text> : null}
      {day.isPending ? <Loading /> : day.isError || !shown ? <Failed title={t("today.error.load")} onRetry={() => void day.refetch()} /> : shown.sessions.length === 0 ? (
        <Empty title={t("today.empty")} body={t("today.emptyBody")} />
      ) : (
        <View style={{ gap: space[3] }}>
          {shown.sessions.map((s) => <SessionCard key={s.id} session={s} canRecord={canRecord} queued={queuedIds.has(s.id)} onOutcome={onOutcome} />)}
        </View>
      )}
      {!canRecord && date > today ? <Text variant="muted">{t("today.futureHint")}</Text> : null}
      <Button label={t("shell.signOut")} variant="ghost" onPress={() => void signOut()} />
      {confirm ? (
        <Sheet title={t("today.unpaidTitle")} onClose={() => setConfirm(null)}>
          <Text>{t("today.unpaidBody", { name: confirm.client_name })}</Text>
          <Button block label={t("today.deliverAnyway")} onPress={() => { void record(confirm.id, "completed"); setStatus(t("today.flagged", { name: confirm.client_name })); setConfirm(null); }} />
        </Sheet>
      ) : null}
      {walkIn && coach ? <WalkInSheet coach={coach} onClose={() => setWalkIn(false)} onDone={(name) => { setWalkIn(false); setStatus(t("today.walkInDone", { name })); }} /> : null}
    </Screen>
  );
}

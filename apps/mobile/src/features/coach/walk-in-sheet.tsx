import { useState } from "react";
import { Pressable, ScrollView } from "react-native";
import { startWalkIn } from "@gymos/api/sessions/coach";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { useCoachMutation, useSchedulable } from "@gymos/api/sessions/use-coach-data";
import { t } from "@gymos/i18n";
import { radius, space, TAP, useColors } from "@/theme";
import { Button } from "@/ui/button";
import { Sheet } from "@/ui/sheet";
import { Loading } from "@/ui/states";
import { Text } from "@/ui/text";

/** A client turns up outside their slot: record a completed session now (fn_start_walkin_session; same credit rules). */
export function WalkInSheet({ coach, onClose, onDone }: { coach: string; onClose: () => void; onDone: (name: string) => void }) {
  const c = useColors();
  const clients = useSchedulable(coach);
  const [picked, setPicked] = useState<string | null>(null);
  const client = clients.data?.find((x) => x.client_id === picked);
  const start = useCoachMutation(() => startWalkIn(picked!));
  return (
    <Sheet title={t("today.walkInTitle")} onClose={onClose} testID="walk-in-sheet">
      {clients.isPending ? <Loading /> : (
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: space[2] }}>
          {(clients.data ?? []).map((x) => (
            <Pressable
              key={x.client_id}
              accessibilityRole="radio"
              accessibilityState={{ selected: picked === x.client_id }}
              aria-checked={picked === x.client_id}
              onPress={() => setPicked(x.client_id)}
              style={{ minHeight: TAP, justifyContent: "center", paddingHorizontal: space[3], borderRadius: radius.md, borderWidth: 1, borderColor: picked === x.client_id ? c.foreground : c.border }}
            >
              <Text>{t("schedule.clientOption", { name: x.full_name, n: x.credits_left })}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      <Text variant="small">{client && client.credits_left <= 0 ? t("today.unpaidWarning") : t("today.walkInHint")}</Text>
      {start.isError ? <Text variant="error" accessibilityRole="alert">{t(coachingErrorKey(start.error))}</Text> : null}
      <Button block label={t("today.walkInStart")} disabled={!client} busy={start.isPending} onPress={() => start.mutate(undefined, { onSuccess: () => onDone(client!.full_name) })} />
    </Sheet>
  );
}

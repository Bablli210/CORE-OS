import { ActivityIndicator, View } from "react-native";
import { t } from "@gymos/i18n";
import { space, useColors } from "@/theme";
import { Button } from "./button";
import { Text } from "./text";

/** Loading, empty and error states (CLAUDE.md: every empty state names the next action; every error says what to do). */
export function Loading() {
  const c = useColors();
  return <View accessibilityLabel={t("common.loading")} style={{ padding: space[8], alignItems: "center" }}><ActivityIndicator color={c.foreground} /></View>;
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={{ paddingVertical: space[8], gap: space[2], alignItems: "center" }}>
      <Text variant="heading" style={{ textAlign: "center" }}>{title}</Text>
      {body ? <Text variant="muted" style={{ textAlign: "center" }}>{body}</Text> : null}
      {action ? <Button label={action.label} variant="outline" onPress={action.onPress} /> : null}
    </View>
  );
}

export function Failed({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <View accessibilityRole="alert" style={{ paddingVertical: space[8], gap: space[2], alignItems: "center" }}>
      <Text variant="heading">{title}</Text>
      <Text variant="muted" style={{ textAlign: "center" }}>{t("error.retryHint")}</Text>
      <Button label={t("common.retry")} variant="outline" onPress={onRetry} />
    </View>
  );
}

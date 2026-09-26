import { View } from "react-native";
import { radius, space, useColors } from "@/theme";
import { Text } from "./text";

type Tone = "neutral" | "destructive" | "warning" | "success" | "outline";

export function Badge({ label, tone = "neutral", testID }: { label: string; tone?: Tone; testID?: string }) {
  const c = useColors();
  const bg = { neutral: c.secondary, destructive: c.destructive, warning: c.warning, success: c.success, outline: c.background }[tone];
  const fg = { neutral: c.secondaryForeground, destructive: c.destructiveForeground, warning: c.warningForeground, success: c.successForeground, outline: c.foreground }[tone];
  return (
    <View testID={testID} style={{ backgroundColor: bg, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: 2, borderWidth: tone === "outline" ? 1 : 0, borderColor: c.border, alignSelf: "flex-start" }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "500" }}>{label}</Text>
    </View>
  );
}

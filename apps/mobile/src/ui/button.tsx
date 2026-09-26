import { ActivityIndicator, Pressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import { radius, space, TAP, useColors } from "@/theme";
import { Text } from "./text";

type Variant = "primary" | "outline" | "ghost" | "success" | "warning" | "neutral";

/** A tap target of at least 48px. `block` = the full-width primary action at the bottom of a screen (CLAUDE.md rule 7). */
export function Button({ label, variant = "primary", block, busy, selected, style, ...props }: Omit<PressableProps, "style"> & { label: string; variant?: Variant; block?: boolean; busy?: boolean; selected?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  const bg = { primary: c.primary, outline: c.background, ghost: "transparent", success: c.success, warning: c.warning, neutral: c.foreground }[variant];
  const fg = { primary: c.primaryForeground, outline: c.foreground, ghost: c.foreground, success: c.successForeground, warning: c.warningForeground, neutral: c.background }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled || busy, selected }}
      {...props}
      disabled={props.disabled || busy}
      style={({ pressed }) => [
        { minHeight: TAP, paddingHorizontal: space[4], borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: bg, opacity: props.disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === "outline" ? { borderWidth: 1, borderColor: c.border } : null,
        block ? { alignSelf: "stretch" } : null,
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontWeight: "600", fontSize: 15 }}>{label}</Text>}
    </Pressable>
  );
}

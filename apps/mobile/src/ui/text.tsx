import { Text as RNText, type TextProps } from "react-native";
import { useColors } from "@/theme";

type Variant = "title" | "heading" | "body" | "muted" | "small" | "error" | "success" | "info";

const SIZES: Record<Variant, { fontSize: number; fontWeight?: "400" | "500" | "600" | "700" }> = {
  title: { fontSize: 24, fontWeight: "700" },
  heading: { fontSize: 17, fontWeight: "600" },
  body: { fontSize: 16 },
  muted: { fontSize: 14 },
  small: { fontSize: 13 },
  error: { fontSize: 14 },
  success: { fontSize: 14 },
  info: { fontSize: 14 },
};

/** Text in a token colour. Every string passed in comes from t(). */
export function Text({ variant = "body", style, ...props }: TextProps & { variant?: Variant }) {
  const c = useColors();
  const color = { muted: c.mutedForeground, small: c.mutedForeground, error: c.destructive, success: c.success, info: c.info }[variant as string] ?? c.foreground;
  return <RNText {...props} style={[SIZES[variant], { color }, style]} />;
}

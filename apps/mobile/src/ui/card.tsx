import { View, type ViewProps } from "react-native";
import { radius, space, useColors } from "@/theme";

export function Card({ style, ...props }: ViewProps) {
  const c = useColors();
  return <View {...props} style={[{ backgroundColor: c.card, borderColor: c.border, borderWidth: 1, borderRadius: radius.lg, padding: space[3], gap: space[2] }, style]} />;
}

import { TextInput, View, type TextInputProps } from "react-native";
import { radius, space, TAP, useColors } from "@/theme";
import { Text } from "./text";

/** A labelled input; the label is the accessible name (web: aria-label). */
export function Field({ label, hint, style, ...props }: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space[1] }}>
      <Text variant="small">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.mutedForeground}
        {...props}
        style={[{ minHeight: TAP, borderWidth: 1, borderColor: c.input, borderRadius: radius.md, paddingHorizontal: space[3], color: c.foreground, backgroundColor: c.background, fontSize: 16 }, style]}
      />
      {hint ? <Text variant="small">{hint}</Text> : null}
    </View>
  );
}

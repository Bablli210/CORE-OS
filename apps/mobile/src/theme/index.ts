import { useColorScheme } from "react-native";
import { tokens } from "./tokens";

export type Colors = typeof tokens.light | typeof tokens.dark;

/** Semantic colours for the current light/dark scheme; spacing, radius and the 48px tap target from the tokens. */
export function useColors(): Colors {
  return useColorScheme() === "dark" ? tokens.dark : tokens.light;
}
export const space = tokens.space;
export const radius = tokens.radius;
export const TAP = tokens.tap;

import tseslint from "typescript-eslint";

// CLAUDE.md: no hard-coded colours — the phone reads src/theme/tokens.ts, generated from the web's tokens.css.
const colorValue = "^\\s*(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch)\\()";

export default tseslint.config(
  { ignores: ["node_modules/**", "dist-web/**", ".expo/**", "expo-env.d.ts", "src/theme/tokens.ts", "scripts/**", "metro.config.js"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-syntax": ["error", { selector: `Literal[value=/${colorValue}/]`, message: "No hard-coded colours; use useTheme() colours from src/theme." }],
      "no-restricted-imports": ["error", { paths: [{ name: "react-dom", message: "React Native app: no React-DOM." }] }],
    },
  },
);

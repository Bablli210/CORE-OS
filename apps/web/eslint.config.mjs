import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

// CLAUDE.md: "No hard-coded colors; use tokens from src/styles/tokens.css."
// Blocks hex/rgb/hsl/oklch literals, Tailwind palette classes (bg-red-500, text-white) and arbitrary colours (bg-[#fff]).
const palette =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white";
const utilities = "bg|text|border|ring|outline|fill|stroke|from|via|to|decoration|divide|placeholder|caret|accent|shadow";
const colorClass = `(^|\\s|:)(${utilities})-((${palette})(-\\d{2,3})?|\\[(#|rgb|hsl|oklch))`;
const colorValue = "^\\s*(#[0-9a-fA-F]{3,8}|(rgb|rgba|hsl|hsla|oklch)\\()";
const noHardCodedColors = [
  "error",
  { selector: `Literal[value=/${colorClass}/]`, message: "Use a semantic token utility (bg-primary, text-muted-foreground, …) — see src/styles/tokens.css." },
  { selector: `TemplateElement[value.raw=/${colorClass}/]`, message: "Use a semantic token utility — see src/styles/tokens.css." },
  { selector: `Literal[value=/${colorValue}/]`, message: "No hard-coded colours; reference a token with var(--token) instead." },
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/database.types.ts"],
    rules: { "no-restricted-syntax": noHardCodedColors },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
      "src/lib/database.types.ts",
      "public/sw.js",
      "public/swe-worker-*.js",
    ],
  },
];

export default eslintConfig;

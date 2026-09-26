import tseslint from "typescript-eslint";

// The shared layer runs in the browser (Next.js) and on the phone (Expo): no DOM, no Next, no React Native here.
// Device specifics come in through platform.ts; the Supabase client through supabase.ts.
export default tseslint.config(
  { ignores: ["node_modules/**", "database.types.ts"] },
  ...tseslint.configs.recommended,
  {
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "react-dom", message: "packages/api is shared with the Expo app: no React-DOM." },
          { name: "react-native", message: "packages/api is platform-neutral: the phone's specifics go through platform.ts." },
          { name: "idb-keyval", message: "Use platform().kv() — IndexedDB is the web's implementation." },
        ],
        patterns: [
          { group: ["react-dom/*", "next", "next/*", "@supabase/ssr", "expo*", "@react-native*"], message: "packages/api is shared by web and mobile: no app-specific imports." },
        ],
      }],
      "no-restricted-globals": ["error",
        { name: "window", message: "Use platform() (storage, kv, connectivity)." },
        { name: "document", message: "No DOM in the shared layer." },
        { name: "navigator", message: "Use platform().connectivity." },
        { name: "localStorage", message: "Use platform().storage." },
        { name: "indexedDB", message: "Use platform().kv()." },
      ],
    },
  },
);

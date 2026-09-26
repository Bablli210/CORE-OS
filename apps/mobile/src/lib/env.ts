/**
 * Expo inlines EXPO_PUBLIC_* at build time (read by literal name). `pnpm env:local` writes apps/mobile/.env.local from
 * the local Supabase stack. On a phone the URL must be reachable from the phone (your computer's LAN address, not 127.0.0.1).
 */
function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`${name} is not set. Run \`pnpm env:local\` with the local Supabase stack running.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
  },
};

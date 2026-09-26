function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`${name} is not set. Run \`pnpm env:local\` with the local Supabase stack running (see .env.example).`);
  }
  return value;
}

/** Public (browser-safe) settings. Next inlines NEXT_PUBLIC_* at build time, so they are read by literal name. */
export const publicEnv = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  },
};

# GymOS mobile (Expo)

The same product on the phone, without a second backend (docs/05 M8). v1 scope:
- the **client app**: Today, the workout logger (works offline), and Credits;
- the **coach app**: Today (outcomes and walk-ins), Clients, and Schedule.

Sales, front desk and top management are pointed to the web app.

Everything talks to Supabase through `@gymos/api`, the same RPC queries and hooks the web uses. This app only registers:
- its client (`src/lib/supabase.ts`);
- its device platform (`src/lib/platform.ts`: AsyncStorage, NetInfo).

## Run it

```sh
supabase start -x studio,imgproxy,logflare,vector,supavisor && supabase db reset && pnpm seed:auth
pnpm env:local                 # writes apps/mobile/.env.local (EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY)
pnpm --filter @gymos/mobile start   # Expo dev server: press i / a, or scan with Expo Go
```

On a physical phone, `127.0.0.1` in `.env.local` must become your computer's LAN address, because the phone has to reach Supabase.

Logins:
- staff: `coach1.a@gymos.local` / `gymos-dev`;
- members: `01110000001` with code `123456`.

## Web build (what the e2e suite drives)

```sh
pnpm --filter @gymos/mobile export:web && pnpm --filter @gymos/mobile serve:web   # http://localhost:8082 (open "/")
```

`pnpm test:e2e` builds and serves it automatically. `e2e/mobile/*` runs at 390px as the `expo-390` project.

## Push

`expo-notifications` registers the device's Expo push token on sign-in (`fn_register_push_token`) and unregisters it on sign-out. `notify` with `PUSH_PROVIDER=expo` delivers `channel = push` notifications to those devices.

To turn it on:
1. Run `eas init`, which sets `extra.eas.projectId` in the app config.
2. Build with EAS.

Without a project id, the app skips push registration and everything else works.

## Theme

`src/theme/tokens.ts` is generated from `apps/web/src/styles/tokens.css` by `pnpm --filter @gymos/mobile tokens`. Branding changes the CSS only, then you regenerate. A unit test fails when the two drift.

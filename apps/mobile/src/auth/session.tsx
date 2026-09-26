import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadSession, type Session } from "@gymos/api/auth/session";
import { clearClientCaches } from "@gymos/api/training/offline/cache";
import { disablePush, enablePush } from "@/lib/push";
import { createClient } from "@/lib/supabase";
import { scopeFor, type Scope } from "./scope";

type State = { status: "loading" } | { status: "signed-out" } | { status: "ready"; session: Session; scope: Scope };
type Ctx = { state: State; refresh: () => Promise<void>; signOut: () => Promise<void> };

const SessionContext = createContext<Ctx | null>(null);

/** Who is signed in on this phone, and which app they get. Follows Supabase auth events (sign-in, refresh, sign-out). */
export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    const db = createClient();
    const { data } = await db.auth.getSession();
    if (!data.session) return setState({ status: "signed-out" });
    const session = await loadSession(db).catch(() => null);
    setState(session ? { status: "ready", session, scope: scopeFor(session) } : { status: "signed-out" });
    if (session) void enablePush();
  }, []);

  useEffect(() => {
    void refresh();
    const { data } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await disablePush();
    await createClient().auth.signOut();
    await clearClientCaches(); // a shared phone forgets the member's cached data; queued workouts stay until sent
    queryClient.clear();
    setState({ status: "signed-out" });
  }, [queryClient]);

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Ctx {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession() outside SessionProvider");
  return ctx;
}

/** The membership the current app acts through (the coach's or the client's). */
export function useMembership() {
  const { state } = useSession();
  return state.status === "ready" && state.scope.kind !== "unsupported" ? state.scope.membership : null;
}

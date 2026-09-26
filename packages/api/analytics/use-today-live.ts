"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import { createClient } from "../supabase";
import { analyticsKeys, fetchToday } from "./analytics";

/**
 * The live "today" strip (fn_today_live): polled every 30s, and refetched as soon as any event lands (Realtime on
 * `events`; RLS lets top management, head coaches and sales managers receive their branches' rows). A check-in at the
 * kiosk emits visit.recorded, so the strip moves within a second or two, and within 30s even if the socket drops.
 */
export function useTodayLive() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel("events:today")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "events" }, () => {
          void queryClient.invalidateQueries({ queryKey: analyticsKeys.today });
        })
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [queryClient]);
  return useQuery({ queryKey: analyticsKeys.today, queryFn: fetchToday, refetchInterval: 30_000, refetchIntervalInBackground: false });
}

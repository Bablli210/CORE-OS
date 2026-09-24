"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { fetchNotifications, fetchUnreadCount, markRead, notificationKeys } from "../queries/notifications";

export function useNotifications() {
  return useQuery({ queryKey: notificationKeys.list(), queryFn: fetchNotifications });
}

export function useUnreadCount() {
  return useQuery({ queryKey: notificationKeys.unread(), queryFn: fetchUnreadCount });
}

export function useMarkRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids?: string[]) => markRead(ids),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/**
 * Live updates: any insert/update on the user's own notification rows refreshes the bell and the list
 * (Realtime postgres_changes; RLS still decides what the user may receive).
 */
export function useNotificationsRealtime(userId: string) {
  const queryClient = useQueryClient();
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    (async () => {
      // Join with the user's token, not the anon key: otherwise RLS filters every event out.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) await supabase.realtime.setAuth(session.access_token);
      if (cancelled) return;
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${userId}` },
          () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);
}

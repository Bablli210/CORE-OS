"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@gymos/i18n";
import { coachingErrorKey, isNetworkError } from "./errors";
import { applyOutcome, dequeue, enqueue, readQueue, writeQueue, type QueuedOutcome } from "./outcome-queue";
import { coachKeys, recordAttendance, type CoachDay, type Outcome } from "./coach";
import { platform } from "../platform";

const storage = () => platform().storage;
const RETRY_MS = 15_000;

/**
 * One tap per outcome (docs/04 Today). The row changes at once; the RPC runs behind it.
 * - The database refuses (not allowed, …) → the row rolls back and the reason shows.
 * - No signal → the tap is queued (platform storage: localStorage / AsyncStorage) and replayed when the phone is back online, every 15 s, and on the next open.
 * - Past the edit window → the database files an approval for the head coach; the row goes back and says so.
 */
export function useOutcomes(coach: string | null, date: string) {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<QueuedOutcome[]>([]);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const flushing = useRef(false);
  const update = useCallback((fn: (q: QueuedOutcome[]) => QueuedOutcome[]) => {
    setQueue((q) => {
      const next = fn(q);
      writeQueue(storage(), next);
      return next;
    });
  }, []);

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["live"] });
    void queryClient.invalidateQueries({ queryKey: ["coaching"] });
  }, [queryClient]);

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (const item of readQueue(storage())) {
        try {
          const res = await recordAttendance(item.sessionId, item.outcome);
          update((q) => dequeue(q, item.sessionId, item.outcome));
          if (!res.ok) setMessage({ tone: "info", text: t("today.sentForApproval") });
        } catch (error) {
          if (isNetworkError(error)) break; // still offline: keep the rest for later
          update((q) => dequeue(q, item.sessionId, item.outcome));
          setMessage({ tone: "error", text: t("today.syncFailed", { reason: t(coachingErrorKey(error)) }) });
        }
      }
    } finally {
      flushing.current = false;
      refresh();
    }
  }, [refresh, update]);

  useEffect(() => {
    setQueue(readQueue(storage()));
    void flush();
    const unsubscribe = platform().connectivity.subscribe((online) => {
      if (online) void flush();
    });
    const timer = setInterval(() => {
      if (readQueue(storage()).length) void flush();
    }, RETRY_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [flush]);

  const record = useCallback(
    async (sessionId: string, outcome: Outcome) => {
      if (!coach) return;
      const key = coachKeys.day(coach, date);
      setMessage(null);
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<CoachDay>(key);
      if (before) queryClient.setQueryData<CoachDay>(key, applyOutcome(before, sessionId, outcome));
      // a queued tap for this session is superseded by this one
      update((q) => dequeue(q, sessionId));
      try {
        const res = await recordAttendance(sessionId, outcome);
        if (!res.ok) {
          if (before) queryClient.setQueryData<CoachDay>(key, before);
          setMessage({ tone: "info", text: t("today.sentForApproval") });
        }
        refresh();
      } catch (error) {
        if (isNetworkError(error)) {
          update((q) => enqueue(q, { sessionId, outcome, coach, date, queuedAt: new Date().toISOString() }));
          return;
        }
        if (before) queryClient.setQueryData<CoachDay>(key, before);
        setMessage({ tone: "error", text: t(coachingErrorKey(error)) });
      }
    },
    [coach, date, queryClient, refresh, update],
  );

  return { record, queue, message, clearMessage: () => setMessage(null), retryNow: flush };
}

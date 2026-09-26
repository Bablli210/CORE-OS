"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { isNetworkError } from "../sessions/errors";
import { enqueue, flush, pending, discard, type OutboxItem } from "./offline/outbox";
import { sendItem } from "./offline/send";
import { platform } from "../platform";

const RETRY_MS = 15_000;

type Outbox = {
  /** Queued items not yet on the server (parked failures included, with `error`). */
  items: OutboxItem[];
  /** Queue a write and try to send it now. Resolves once it is safely on the phone. */
  push: (item: OutboxItem) => Promise<void>;
  retry: () => Promise<void>;
  discard: (key: string) => Promise<void>;
  online: boolean;
};

const OutboxContext = createContext<Outbox | null>(null);

/**
 * One outbox for the client area: sends on write, when the phone comes back online, every 15 s while anything waits,
 * and when the app opens. After a successful send the client screens refetch (PR badges, progress, Today).
 */
export function OutboxProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [online, setOnline] = useState(true);
  const running = useRef(false);

  const refresh = useCallback(async () => setItems(await pending().catch(() => [])), []);

  const retry = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const r = await flush(sendItem, isNetworkError);
      if (r.sent.length) await queryClient.invalidateQueries({ queryKey: ["client"] });
    } finally {
      running.current = false;
      await refresh();
    }
  }, [queryClient, refresh]);

  useEffect(() => {
    const net = platform().connectivity;
    setOnline(net.isOnline());
    void retry();
    const unsubscribe = net.subscribe((up) => {
      setOnline(up);
      if (up) void retry();
    });
    const timer = setInterval(async () => {
      if ((await pending().catch(() => [])).some((i) => !i.error)) void retry();
    }, RETRY_MS);
    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [retry]);

  const value = useMemo<Outbox>(
    () => ({
      items,
      online,
      retry,
      push: async (item) => {
        await enqueue(item);
        await refresh();
        void retry();
      },
      discard: async (key) => {
        await discard(key);
        await refresh();
      },
    }),
    [items, online, refresh, retry],
  );
  return <OutboxContext.Provider value={value}>{children}</OutboxContext.Provider>;
}

export function useOutbox(): Outbox {
  const ctx = useContext(OutboxContext);
  if (!ctx) throw new Error("useOutbox() must be used inside the client area (OutboxProvider)");
  return ctx;
}

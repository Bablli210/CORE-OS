"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useMe } from "@/features/auth/me-context";
import * as q from "../queries/coach";

/** The coach membership the signed-in person coaches through in the active branch (a head coach has one too). */
export function useOwnCoachMembership(): string | null {
  const me = useMe();
  if (me.active.role === "coach") return me.active.id;
  return me.memberships.find((m) => m.role === "coach" && m.branchId === me.active.branchId)?.id ?? null;
}

export const useWeek = (coach: string | null, start: string) =>
  useQuery({ queryKey: q.coachKeys.week(coach ?? "", start), queryFn: () => q.fetchWeek(coach!, start), enabled: !!coach });
export const useSchedulable = (coach: string | null) =>
  useQuery({ queryKey: q.coachKeys.clients(coach ?? ""), queryFn: () => q.fetchSchedulable(coach!), enabled: !!coach, staleTime: 30_000 });
export const useDay = (coach: string | null, date: string) =>
  useQuery({ queryKey: q.coachKeys.day(coach ?? "", date), queryFn: () => q.fetchDay(coach!, date), enabled: !!coach });

/** Schedule writes refresh the week, the day and the client lists. */
export function useCoachMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([q.coachKeys.all, ["live"], ["coaching"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** md and up: the full week grid; below: one day at a time. */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

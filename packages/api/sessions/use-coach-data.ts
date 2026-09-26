import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as q from "./coach";

/** The coach's week, schedulable clients and day (web and phone). Which coach is decided by the app (its "me"). */
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

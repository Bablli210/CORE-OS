"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as q from "../queries/coaching";

export const useCoachClients = (coach: string | null) =>
  useQuery({ queryKey: q.coachingKeys.clients(coach ?? ""), queryFn: () => q.fetchCoachClients(coach!), enabled: !!coach });
export const useCoachClient = (id: string) => useQuery({ queryKey: q.coachingKeys.client(id), queryFn: () => q.fetchCoachClient(id) });
export const useTeam = (branch: string | null, month: string) =>
  useQuery({ queryKey: q.coachingKeys.team(branch ?? "", month), queryFn: () => q.fetchTeam(branch!, month), enabled: !!branch });
export const useRanked = (client: string | null) =>
  useQuery({ queryKey: q.coachingKeys.ranked(client ?? ""), queryFn: () => q.fetchRanked(client!), enabled: !!client });
export const useHeatmap = () => useQuery({ queryKey: q.coachingKeys.heatmap, queryFn: q.fetchHeatmap, staleTime: 300_000 });
export const useBranchAdherence = () => useQuery({ queryKey: q.coachingKeys.adherence, queryFn: q.fetchBranchAdherence, staleTime: 60_000 });

/** Coaching writes refresh the coaching lists, the week/day and the live screens. */
export function useCoachingMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => Promise.all([q.coachingKeys.all, ["coach"], ["live"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

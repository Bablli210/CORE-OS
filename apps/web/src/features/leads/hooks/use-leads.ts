"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LIVE_KEY } from "@/features/notifications/queries/notifications";
import type { LeadStatus } from "../labels";
import * as q from "../queries/leads";

export function useLeads(branchId: string, status?: LeadStatus, search?: string) {
  return useQuery({ queryKey: q.leadKeys.list(branchId, status, search), queryFn: () => q.fetchLeads(branchId, status, search) });
}

export function useLead(id: string) {
  return useQuery({ queryKey: q.leadKeys.detail(id), queryFn: () => q.fetchLead(id) });
}

export function useReps(branchId: string) {
  return useQuery({ queryKey: q.leadKeys.reps(branchId), queryFn: () => q.fetchReps(branchId) });
}

/** Any sales write refreshes lead lists/details and the live screens (Today, Queue). */
export function useSalesMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: q.leadKeys.all }), queryClient.invalidateQueries({ queryKey: LIVE_KEY })]);
    },
  });
}

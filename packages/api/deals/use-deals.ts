"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LIVE_KEY } from "../notifications/notifications";
import { leadKeys } from "../leads/leads";
import type { DealStatus } from "./labels";
import * as q from "./deals";

export const useDeal = (id: string) => useQuery({ queryKey: q.dealKeys.detail(id), queryFn: () => q.fetchDeal(id) });
export const useDeals = (branchId: string, status?: DealStatus, search?: string) =>
  useQuery({ queryKey: q.dealKeys.list(branchId, status, search), queryFn: () => q.fetchDeals(branchId, status, search) });
export const useCatalog = (branchId: string) => useQuery({ queryKey: q.dealKeys.catalog(branchId), queryFn: () => q.fetchCatalog(branchId), staleTime: 60_000 });
export const useBranchCoaches = (branchId: string) => useQuery({ queryKey: q.dealKeys.coaches(branchId), queryFn: () => q.fetchCoaches(branchId), staleTime: 60_000 });
export const useRankedCoaches = (leadId?: string, clientId?: string) =>
  useQuery({ queryKey: q.dealKeys.ranked(leadId, clientId), queryFn: () => q.fetchRanked(leadId, clientId), enabled: !!(leadId || clientId), staleTime: 60_000 });

/** Deal/approval/credit writes refresh deals, leads, credits and the live screens. */
export function useMoneyMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      Promise.all(
        [q.dealKeys.all, leadKeys.all, LIVE_KEY, ["credits"], ["approvals"], ["money"]].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      ),
  });
}

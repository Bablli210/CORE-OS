"use client";

import { useQuery } from "@tanstack/react-query";
import * as q from "./analytics";

export const useTiles = (screen: q.Screen, month: string, scope: string | null, enabled = true) =>
  useQuery({ queryKey: q.analyticsKeys.tiles(screen, month, scope), queryFn: () => q.fetchTiles(screen, month, scope), enabled });
export const useRows = (metric: string, month: string, scope: string | null, extra: Record<string, number>) =>
  useQuery({ queryKey: q.analyticsKeys.rows(metric, month, scope, JSON.stringify(extra)), queryFn: () => q.fetchRows(metric, month, scope, extra) });
export const useTargets = (period: string, all = false) => useQuery({ queryKey: q.analyticsKeys.targets(period, all), queryFn: () => q.fetchTargets(period, all) });
export const useCoachWeeks = (branch: string | null) => useQuery({ queryKey: q.analyticsKeys.coachWeeks(branch), queryFn: () => q.fetchCoachWeeks(branch) });
export const useWeekly = () => useQuery({ queryKey: q.analyticsKeys.weekly, queryFn: q.fetchWeekly });
export const useRepExtra = (month: string) => useQuery({ queryKey: q.analyticsKeys.repExtra(month), queryFn: () => q.fetchRepExtra(month) });
export const useSources = (month: string) => useQuery({ queryKey: q.analyticsKeys.sources(month), queryFn: () => q.fetchSources(month) });
export const useAudit = (f: Parameters<typeof q.fetchAudit>[0]) => useQuery({ queryKey: q.analyticsKeys.audit(JSON.stringify(f)), queryFn: () => q.fetchAudit(f) });

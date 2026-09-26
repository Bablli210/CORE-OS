"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchNumbers, fetchQueue, fetchTeam, fetchToday, salesKeys } from "./sales";

export const useToday = (branchId: string) => useQuery({ queryKey: salesKeys.today(branchId), queryFn: () => fetchToday(branchId) });
export const useQueue = (branchId: string) => useQuery({ queryKey: salesKeys.queue(branchId), queryFn: () => fetchQueue(branchId) });
export const useTeam = (branchId: string, month: string) => useQuery({ queryKey: salesKeys.team(branchId, month), queryFn: () => fetchTeam(branchId, month) });
export const useNumbers = (branchId: string, month: string) =>
  useQuery({ queryKey: salesKeys.numbers(branchId, month), queryFn: () => fetchNumbers(branchId, month) });

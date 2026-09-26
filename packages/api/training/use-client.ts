"use client";

import { useQuery } from "@tanstack/react-query";
import { isNetworkError } from "../sessions/errors";
import { networkFirst } from "./offline/cache";
import * as q from "./client";

// Today and the logger open without signal from their last good copy (IndexedDB); the other screens need the network.
export const useHome = () => useQuery({ queryKey: q.clientKeys.home, queryFn: () => networkFirst("home", q.fetchHome, isNetworkError), networkMode: "always" });
export const useTraining = () =>
  useQuery({ queryKey: q.clientKeys.training, queryFn: () => networkFirst("training", q.fetchTraining, isNetworkError), networkMode: "always", staleTime: 60_000 });
export const useProgress = (exercise: string | null) => useQuery({ queryKey: q.clientKeys.progress(exercise), queryFn: () => q.fetchProgress(exercise) });
export const useCredits = () => useQuery({ queryKey: q.clientKeys.credits, queryFn: q.fetchCredits });

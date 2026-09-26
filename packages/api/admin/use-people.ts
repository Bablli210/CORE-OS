"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPeople, peopleKeys, saveMembership, setPersonActive } from "./people";
import type { MembershipInput } from "./people-schema";

export function usePeople() {
  return useQuery({ queryKey: peopleKeys.all, queryFn: fetchPeople });
}

export function useSaveMembership(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ membershipId, input }: { membershipId: string | null; input: MembershipInput }) => saveMembership(profileId, membershipId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  });
}

export function useSetPersonActive(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (active: boolean) => setPersonActive(profileId, active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  });
}

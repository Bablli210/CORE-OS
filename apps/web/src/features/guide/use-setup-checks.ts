"use client";

import { useQuery } from "@tanstack/react-query";
import { usePeople } from "@gymos/api/admin/use-people";
import { fetchProducts, productKeys } from "@gymos/api/admin/products";
import { useTargets } from "@gymos/api/analytics/use-analytics";
import { cairoMonth } from "@gymos/api/format";
import type { SetupCheck } from "@gymos/api/guide/guides";

/** Top management's setup, read from real data: staff beyond yourself, a priced product, a target this month. */
export function useSetupChecks(): Set<SetupCheck> {
  const people = usePeople();
  const products = useQuery({ queryKey: productKeys.all, queryFn: fetchProducts });
  const targets = useTargets(cairoMonth());
  const done = new Set<SetupCheck>();
  if ((people.data ?? []).filter((p) => p.isActive && p.memberships.some((m) => m.role !== "client" && m.role !== "top_management")).length > 0) done.add("staff");
  if ((products.data ?? []).some((p) => p.is_active)) done.add("products");
  if ((targets.data ?? []).some((x) => x.target !== null)) done.add("targets");
  return done;
}

"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/features/auth/me-context";

/** The coach membership the signed-in person coaches through in the active branch (a head coach has one too). */
export function useOwnCoachMembership(): string | null {
  const me = useMe();
  if (me.active.role === "coach") return me.active.id;
  return me.memberships.find((m) => m.role === "coach" && m.branchId === me.active.branchId)?.id ?? null;
}

export { useCoachMutation, useDay, useSchedulable, useWeek } from "@gymos/api/sessions/use-coach-data";

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

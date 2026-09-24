"use client";

import { createContext, useContext } from "react";
import type { Me } from "./me";

const MeContext = createContext<Me | null>(null);

export function MeProvider({ me, children }: { me: Me; children: React.ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

/** Profile, memberships, active role + branch and branch ids of the signed-in person (inside an app area). */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe() must be used inside an app area (MeProvider)");
  return me;
}

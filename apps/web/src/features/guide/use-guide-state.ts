"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Per-person, per-device guide state (hidden, steps ticked by hand). A convenience only — losing it just shows the guide
 * again — so it lives in localStorage (CLAUDE.md: browser storage for per-viewer conveniences) and every access is guarded.
 */
type State = { hidden: boolean; done: string[] };
const EVENT = "gymos-guide";
const key = (profileId: string, guideId: string) => `gymos.guide.${profileId}.${guideId}`;

function read(k: string): State {
  try {
    const raw = window.localStorage.getItem(k);
    const v = raw ? (JSON.parse(raw) as Partial<State>) : {};
    return { hidden: v.hidden === true, done: Array.isArray(v.done) ? v.done.filter((x): x is string => typeof x === "string") : [] };
  } catch {
    return { hidden: false, done: [] };
  }
}

export function useGuideState(profileId: string, guideId: string) {
  const k = key(profileId, guideId);
  const [state, setState] = useState<State | null>(null); // null until read on the client (no flash of a hidden guide)
  useEffect(() => {
    const load = () => setState(read(k));
    load();
    window.addEventListener(EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, [k]);
  const write = useCallback(
    (next: State) => {
      setState(next);
      try {
        window.localStorage.setItem(k, JSON.stringify(next));
      } catch {
        // storage blocked: the change holds for this page view
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [k],
  );
  return {
    ready: state !== null,
    hidden: state?.hidden ?? false,
    done: new Set(state?.done ?? []),
    setHidden: (hidden: boolean) => write({ hidden, done: state?.done ?? [] }),
    toggle: (id: string) => {
      const done = new Set(state?.done ?? []);
      if (done.has(id)) done.delete(id);
      else done.add(id);
      write({ hidden: state?.hidden ?? false, done: [...done] });
    },
  };
}

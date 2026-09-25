"use client";

import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Counts down the rest after a set (from the program's rest). Sits in the logger's bottom bar above Finish; Skip or +15 s. */
export function RestTimer({ until, onDone, onAdd }: { until: number; onDone: () => void; onAdd: (seconds: number) => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    if (left === 0) {
      if ("vibrate" in navigator) navigator.vibrate?.(200);
      onDone();
    }
  }, [left, onDone]);
  return (
    <div role="timer" aria-live="off" aria-label={t("workout.rest")} data-testid="rest-timer"
      className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
      <span className="flex items-center gap-2 text-lg font-semibold tabular-nums"><Timer aria-hidden className="size-5" />{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</span>
      <span className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => onAdd(15)}>{t("workout.add15")}</Button>
        <Button size="sm" onClick={onDone}>{t("workout.skipRest")}</Button>
      </span>
    </div>
  );
}

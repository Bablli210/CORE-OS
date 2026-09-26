"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { t, type MessageKey } from "@gymos/i18n";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { useCoachMutation } from "../hooks/use-coach";
import { setAvailability, type WorkingHours } from "@gymos/api/sessions/coach";
import { WEEK_ORDER } from "@gymos/api/sessions/week";

type Row = { on: boolean; start: string; end: string };

/** Working hours (coach_availability): the shaded part of the grid and the free gaps on Today. One block per day. */
export function HoursSheet({ coach, hours, onClose, onDone }: { coach: string; hours: WorkingHours[]; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<Record<number, Row>>(() =>
    Object.fromEntries(
      WEEK_ORDER.map((d) => {
        const h = hours.find((x) => x.weekday === d);
        return [d, h ? { on: true, start: h.start_time, end: h.end_time } : { on: false, start: "06:00", end: "14:00" }];
      }),
    ),
  );
  const save = useCoachMutation(() =>
    setAvailability(
      coach,
      WEEK_ORDER.filter((d) => rows[d].on).map((d) => ({ weekday: d, start_time: rows[d].start, end_time: rows[d].end === "00:00" ? "24:00" : rows[d].end })),
    ),
  );
  const update = (d: number, patch: Partial<Row>) => setRows((r) => ({ ...r, [d]: { ...r[d], ...patch } }));

  return (
    <Sheet open onClose={onClose} title={t("hours.title")} closeLabel={t("common.close")}>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save.mutate(undefined, { onSuccess: onDone }); }}>
        {WEEK_ORDER.map((d) => {
          const name = t(`weekday.${d}` as MessageKey);
          return (
            <div key={d} className="grid grid-cols-[6rem_1fr_1fr] items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={rows[d].on} onCheckedChange={(on) => update(d, { on })} aria-label={t("hours.works", { day: name })} />
                {t(`weekday.short.${d}` as MessageKey)}
              </label>
              {rows[d].on ? (
                <>
                  <Input type="time" step={900} aria-label={t("hours.from", { day: name })} value={rows[d].start} onChange={(e) => update(d, { start: e.target.value })} />
                  <Input type="time" step={900} aria-label={t("hours.to", { day: name })} value={rows[d].end} onChange={(e) => update(d, { end: e.target.value })} />
                </>
              ) : (
                <span className="col-span-2 text-sm text-muted-foreground">{t("hours.off")}</span>
              )}
            </div>
          );
        })}
        {save.isError ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(save.error))}</p> : null}
        <Button type="submit" size="block" disabled={save.isPending}>{t("common.save")}</Button>
      </form>
    </Sheet>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t, type MessageKey } from "@gymos/i18n";
import { coachingErrorKey } from "@gymos/api/sessions/errors";
import { useCoachMutation } from "../hooks/use-coach";
import { changeSlot, endSlot, skipSlot, type Slot } from "@gymos/api/sessions/coach";
import { WEEK_ORDER } from "@gymos/api/sessions/week";
import { slotTitle } from "./week-grid";

/** Tap a slot → move or change it, skip one date, or end it. Past sessions are never touched by these. */
export function SlotDetailSheet({
  coach,
  slot,
  date,
  today,
  canEdit,
  onClose,
  onDone,
}: {
  coach: string;
  slot: Slot;
  /** The date of this slot in the week on screen. */
  date: string;
  today: string;
  canEdit: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [weekday, setWeekday] = useState(slot.weekday);
  const [start, setStart] = useState(slot.start_time);
  const [duration, setDuration] = useState(slot.duration_minutes);
  const [label, setLabel] = useState(slot.label ?? "");
  const [reason, setReason] = useState("");
  const change = useCoachMutation(() => changeSlot(coach, slot, { weekday, start, duration, label: label || null }));
  const skip = useCoachMutation(() => skipSlot(slot.id, date, reason.trim()));
  const end = useCoachMutation(() => endSlot(slot.id, today));
  const error = change.error ?? skip.error ?? end.error;
  const skipped = slot.skipped.includes(date);
  const changed = weekday !== slot.weekday || start !== slot.start_time || duration !== slot.duration_minutes || label !== (slot.label ?? "");

  return (
    <Sheet open onClose={onClose} title={slotTitle(slot)} closeLabel={t("common.close")}>
      <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          {t("schedule.every", { day: t(`weekday.${slot.weekday}` as MessageKey), time: slot.start_time, n: slot.duration_minutes })}
          {slot.kind === "client" && slot.credits_left !== null ? ` · ${t("schedule.left", { n: slot.credits_left })}` : ""}
        </p>
        {slot.client_id ? (
          <Link href={`/coach/clients/${slot.client_id}`} className={buttonVariants({ variant: "outline" })}>{t("schedule.openClient")}</Link>
        ) : null}

        {canEdit ? (
          <>
            <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); change.mutate(undefined, { onSuccess: () => onDone(t("schedule.changed")) }); }}>
              <h3 className="text-sm font-semibold">{t("schedule.move")}</h3>
              <div className="grid grid-cols-3 gap-2">
                <Field label={t("schedule.day")} htmlFor="slot-day">
                  <Select id="slot-day" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                    {WEEK_ORDER.map((d) => <option key={d} value={d}>{t(`weekday.short.${d}` as MessageKey)}</option>)}
                  </Select>
                </Field>
                <Field label={t("schedule.start")} htmlFor="slot-move-start">
                  <Input id="slot-move-start" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
                </Field>
                <Field label={t("schedule.duration")} htmlFor="slot-move-duration">
                  <Input id="slot-move-duration" type="number" min={15} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
                </Field>
              </div>
              {slot.kind !== "client" ? (
                <Field label={t("schedule.label")} htmlFor="slot-move-label">
                  <Input id="slot-move-label" value={label} onChange={(e) => setLabel(e.target.value)} />
                </Field>
              ) : null}
              <Button type="submit" variant="outline" disabled={!changed || change.isPending}>{t("schedule.saveChange")}</Button>
            </form>

            {date >= today ? (
              <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); skip.mutate(undefined, { onSuccess: () => onDone(t("schedule.skippedOn", { date })) }); }}>
                <h3 className="text-sm font-semibold">{t("schedule.skipTitle", { date })}</h3>
                {skipped ? (
                  <p className="text-sm text-muted-foreground">{t("schedule.alreadySkipped")}</p>
                ) : (
                  <>
                    <Field label={t("schedule.skipReason")} htmlFor="slot-skip-reason">
                      <Input id="slot-skip-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("schedule.skipPlaceholder")} />
                    </Field>
                    <Button type="submit" variant="outline" disabled={skip.isPending}>{t("schedule.skip")}</Button>
                  </>
                )}
              </form>
            ) : null}

            <div className="grid gap-2 border-t pt-4">
              <p className="text-sm text-muted-foreground">{t("schedule.endHint")}</p>
              <Button variant="destructive" disabled={end.isPending} onClick={() => end.mutate(undefined, { onSuccess: () => onDone(t("schedule.ended")) })}>
                {t("schedule.end")}
              </Button>
            </div>
          </>
        ) : null}
        {error ? <p role="alert" className="text-sm text-destructive">{t(coachingErrorKey(error))}</p> : null}
      </div>
    </Sheet>
  );
}

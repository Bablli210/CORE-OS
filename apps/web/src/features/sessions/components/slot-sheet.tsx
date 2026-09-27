"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t, type MessageKey } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import { coachingErrorKey, failedWeekday } from "@gymos/api/sessions/errors";
import { useCoachMutation } from "../hooks/use-coach";
import { addWeeklySlots, type SchedulableClient, type Slot, type SlotKind } from "@gymos/api/sessions/coach";
import { prefWeekdays } from "@gymos/api/sessions/week";
import { DayChips } from "./day-chips";
import { slotTitle } from "./week-grid";

const KINDS: SlotKind[] = ["client", "class", "blocked"];
const DURATIONS = [30, 45, 60, 75, 90, 120];

/**
 * Tap an hour cell → this sheet. Client (only clients with sessions left with this coach; a client preselected from their page
 * is always offered), class or blocked; the days default to the tapped day plus the days the client asked for at onboarding,
 * so "08:00 Sat/Mon/Wed" is one tap on the cell and one on Save. "Add another client at this time" on a slot opens it at that
 * slot's day, start and length (`sharing`): several clients may share an hour (docs/06 #20). Then only that day is picked,
 * and the clients already in the hour are not offered (they can't be there twice).
 */
export function SlotSheet({
  coach,
  weekday,
  start: initialStart,
  duration: initialDuration,
  sharing,
  startsOn,
  slotMinutes,
  clients,
  presetClientId,
  onClose,
  onDone,
}: {
  coach: string;
  weekday: number;
  /** "08:00" */
  start: string;
  /** Minutes; the coach's default slot length when not given (or not one of the offered lengths). */
  duration?: number;
  /** The slots this one will share the hour with (the tapped one first), when opened from "Add another client at this time". */
  sharing?: Slot[];
  startsOn: string;
  slotMinutes: number;
  clients: SchedulableClient[];
  presetClientId: string | null;
  onClose: () => void;
  onDone: (count: number) => void;
}) {
  const inHour = new Set(sharing?.map((s) => s.client_id));
  const offered = clients.filter((c) => (c.credits_left > 0 || c.client_id === presetClientId) && !inHour.has(c.client_id));
  // sharing an hour is about that one day: the client's preferred days are not added
  const daysFor = (clientId: string) =>
    sharing ? [weekday] : Array.from(new Set([weekday, ...prefWeekdays(clients.find((c) => c.client_id === clientId)?.pref_days)]));
  const initialClient = presetClientId && offered.some((c) => c.client_id === presetClientId) ? presetClientId : "";
  const [kind, setKind] = useState<SlotKind>("client");
  const [clientId, setClientId] = useState(initialClient);
  const [days, setDays] = useState<number[]>(initialClient ? daysFor(initialClient) : [weekday]);
  const [start, setStart] = useState(initialStart);
  const [duration, setDuration] = useState(initialDuration && DURATIONS.includes(initialDuration) ? initialDuration : slotMinutes);
  const [label, setLabel] = useState("");
  const add = useCoachMutation(() => addWeeklySlots({ coach, weekdays: days, start, kind, clientId: kind === "client" ? clientId : null, label: kind === "client" ? null : label, duration, startsOn }));
  const failedDay = add.isError ? failedWeekday(add.error) : null;
  const ready = days.length > 0 && !!start && (kind !== "client" || !!clientId);

  return (
    <Sheet open onClose={onClose} title={t("schedule.newSlot")} closeLabel={t("common.close")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (ready) add.mutate(undefined, { onSuccess: (ids) => onDone(ids.length) });
        }}
      >
        {sharing?.length ? (
          <p className="rounded-md border border-info/40 bg-info/10 p-3 text-sm" data-testid="sharing-hint">
            {t("schedule.sharing", { day: t(`weekday.${weekday}` as MessageKey), time: sharing[0].start_time, what: sharing.map(slotTitle).join(", ") })}{" "}
            {t("schedule.addAnotherHint")}
          </p>
        ) : null}
        <div role="radiogroup" aria-label={t("schedule.kind")} className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={cn("min-h-tap rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", kind === k ? "bg-background font-medium shadow-xs" : "text-muted-foreground")}
            >
              {t(`schedule.kind.${k}` as MessageKey)}
            </button>
          ))}
        </div>

        {kind === "client" ? (
          <Field label={t("schedule.client")} htmlFor="slot-client" hint={offered.length ? t("schedule.clientHint") : t("schedule.noClients")}>
            <Select
              id="slot-client"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                if (e.target.value) setDays(daysFor(e.target.value));
              }}
            >
              <option value="">{t("schedule.pickClient")}</option>
              {offered.map((c) => (
                <option key={c.client_id} value={c.client_id}>
                  {t("schedule.clientOption", { name: c.full_name, n: c.credits_left })}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={t("schedule.label")} htmlFor="slot-label">
            <Input id="slot-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t(kind === "class" ? "schedule.labelClass" : "schedule.labelBlocked")} />
          </Field>
        )}

        <DayChips label={t("schedule.days")} value={days} onChange={setDays} />

        <div className="grid grid-cols-2 gap-3">
          <Field label={t("schedule.start")} htmlFor="slot-start">
            <Input id="slot-start" type="time" step={900} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label={t("schedule.duration")} htmlFor="slot-duration">
            <Select id="slot-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
              {DURATIONS.map((m) => (
                <option key={m} value={m}>{t("schedule.minutes", { n: m })}</option>
              ))}
            </Select>
          </Field>
        </div>
        <p className="text-sm text-muted-foreground">{t("schedule.startsOn", { date: startsOn })}</p>

        {add.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {failedDay !== null
              ? t("schedule.error.onDay", { day: t(`weekday.${failedDay}` as MessageKey), reason: t(coachingErrorKey(add.error)) })
              : t(coachingErrorKey(add.error))}
          </p>
        ) : null}
        <Button type="submit" size="block" disabled={!ready || add.isPending}>
          {days.length > 1 ? t("schedule.addN", { n: days.length }) : t("schedule.add")}
        </Button>
      </form>
    </Sheet>
  );
}

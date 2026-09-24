"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/i18n";
import { useSalesMutation } from "../hooks/use-leads";
import { TOUCH_TYPES, touchLabel, type TouchType } from "../labels";
import { logTouch } from "../queries/leads";
import { salesErrorKey } from "../errors";

/** Two taps to log a call / WhatsApp / visit on a lead or client (fn_log_touch). */
export function LogTouchSheet({
  open,
  onClose,
  target,
  initialType = "call",
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  target: { leadId?: string; clientId?: string; name: string };
  initialType?: TouchType;
  onLogged?: () => void;
}) {
  const [type, setType] = useState<TouchType>(initialType);
  const [direction, setDirection] = useState<"outbound" | "inbound">("outbound");
  const [note, setNote] = useState("");
  const save = useSalesMutation(logTouch);

  return (
    <Sheet open={open} onClose={onClose} title={t("touch.sheetTitle", { name: target.name })} closeLabel={t("common.close")}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(
            { leadId: target.leadId, clientId: target.clientId, type, direction, note },
            {
              onSuccess: () => {
                setNote("");
                onLogged?.();
                onClose();
              },
            },
          );
        }}
      >
        <div role="radiogroup" aria-label={t("touch.type")} className="flex flex-wrap gap-2">
          {TOUCH_TYPES.map((tt) => (
            <Button key={tt} role="radio" aria-checked={type === tt} variant={type === tt ? "default" : "outline"} size="sm" onClick={() => setType(tt)}>
              {t(touchLabel(tt))}
            </Button>
          ))}
        </div>
        {type !== "note" ? (
          <Field label={t("touch.direction")} htmlFor="touch-direction">
            <Select id="touch-direction" value={direction} onChange={(e) => setDirection(e.target.value as "outbound" | "inbound")}>
              <option value="outbound">{t("touch.outbound")}</option>
              <option value="inbound">{t("touch.inbound")}</option>
            </Select>
          </Field>
        ) : null}
        <Field label={t("touch.note")} htmlFor="touch-note">
          <Textarea id="touch-note" className="font-sans" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("touch.notePlaceholder")} />
        </Field>
        {save.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(save.error))}</p> : null}
        <Button type="submit" size="block" disabled={save.isPending}>
          {t("touch.save")}
        </Button>
      </form>
    </Sheet>
  );
}

"use client";

import { MessageCircle, Phone } from "lucide-react";
import { useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { telLink, whatsappLink } from "@gymos/api/contact-links";
import { t } from "@gymos/i18n";
import { cn } from "@/lib/utils";
import type { TouchType } from "@gymos/api/leads/labels";
import { LogTouchSheet } from "./log-touch-sheet";

/** Call (tel:) and WhatsApp (wa.me) open the app and the touch sheet, so the touch is logged in two taps. */
export function ContactButtons({ target, compact = false }: { target: { leadId?: string; clientId?: string; name: string; phone: string }; compact?: boolean }) {
  const [logging, setLogging] = useState<TouchType | null>(null);
  const size = compact ? "sm" : "default";
  return (
    <>
      <a href={telLink(target.phone)} onClick={() => setLogging("call")} className={cn(buttonVariants({ variant: "outline", size }))} aria-label={t("contact.call", { name: target.name })}>
        <Phone aria-hidden />
        {compact ? null : t("contact.callShort")}
      </a>
      <a
        href={whatsappLink(target.phone)}
        target="_blank"
        rel="noreferrer"
        onClick={() => setLogging("whatsapp")}
        className={cn(buttonVariants({ variant: "outline", size }))}
        aria-label={t("contact.whatsapp", { name: target.name })}
      >
        <MessageCircle aria-hidden />
        {compact ? null : t("contact.whatsappShort")}
      </a>
      {logging ? <LogTouchSheet open onClose={() => setLogging(null)} target={target} initialType={logging} /> : null}
    </>
  );
}

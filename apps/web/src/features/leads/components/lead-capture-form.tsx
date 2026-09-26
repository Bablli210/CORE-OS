"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { PhoneInput } from "@/components/phone-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useMe } from "@/features/auth/me-context";
import { t } from "@gymos/i18n";
import { isE164 } from "@gymos/api/phone";
import { useSalesMutation } from "@gymos/api/leads/use-leads";
import { INTERESTS, interestLabel, SOURCES, sourceLabel } from "@gymos/api/leads/labels";
import { createLead, findByPhone } from "@gymos/api/leads/leads";
import { salesErrorKey } from "@gymos/api/leads/errors";
import { DuplicateNotice } from "./duplicate-notice";
import { OnboardingShare } from "./onboarding-share";

/** 30-second capture (docs/04 /sales/leads/new): name, phone with a live duplicate check, source, interests, note. */
export function LeadCaptureForm() {
  const me = useMe();
  const branchId = me.active.branchId ?? me.branches[0]?.id ?? "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<string>("walk_in");
  const [interests, setInterests] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(isE164(phone) ? phone : ""), 300);
    return () => clearTimeout(id);
  }, [phone]);
  const dup = useQuery({ queryKey: ["phone-match", debounced], queryFn: () => findByPhone(debounced), enabled: !!debounced });
  const save = useSalesMutation(createLead);
  const match = debounced && dup.data?.found ? dup.data : null;

  if (created)
    return (
      <div className="grid gap-4">
        <p className="flex items-center gap-2 font-medium" role="status">
          <CheckCircle2 aria-hidden className="size-5 text-success" />
          {t("capture.saved", { name: created.name })}
        </p>
        <OnboardingShare lead={created} />
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/sales/leads/${created.id}`} className={buttonVariants({ variant: "outline" })}>{t("capture.openLead")}</Link>
          <Button variant="outline" onClick={() => { setCreated(null); setName(""); setPhone(""); setNote(""); setInterests([]); setSubmitted(false); }}>
            {t("capture.another")}
          </Button>
        </div>
      </div>
    );

  const nameError = submitted && name.trim().length < 2 ? t("people.error.name") : undefined;
  const phoneError = submitted && !isE164(phone) ? t("phone.error.invalid") : undefined;
  return (
    <form
      noValidate
      className="grid gap-4 pb-20 md:pb-0"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (nameError || name.trim().length < 2 || !isE164(phone) || match) return;
        save.mutate(
          { branchId, fullName: name.trim(), phone, source, interests, note },
          { onSuccess: (r) => (r.duplicate ? setDebounced(phone) : r.lead_id && setCreated({ id: r.lead_id, name: name.trim(), phone })) },
        );
      }}
    >
      <Field label={t("capture.name")} htmlFor="lead-name" error={nameError}>
        <Input id="lead-name" autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError} />
      </Field>
      <Field label={t("login.phone")} htmlFor="lead-phone" error={phoneError}>
        <PhoneInput id="lead-phone" value={phone} onChange={setPhone} invalid={!!phoneError} />
      </Field>
      {match ? <DuplicateNotice match={match} /> : null}
      <Field label={t("capture.source")} htmlFor="lead-source">
        <Select id="lead-source" value={source} onChange={(e) => setSource(e.target.value)}>
          {SOURCES.map((s) => <option key={s} value={s}>{t(sourceLabel(s))}</option>)}
        </Select>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">{t("capture.interests")}</legend>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = interests.includes(i);
            return (
              <Button key={i} size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => setInterests(on ? interests.filter((x) => x !== i) : [...interests, i])}>
                {t(interestLabel(i))}
              </Button>
            );
          })}
        </div>
      </fieldset>
      <Field label={t("capture.note")} htmlFor="lead-note">
        <Textarea id="lead-note" className="font-sans" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <p className="text-sm text-muted-foreground">{t("capture.branch", { branch: me.active.branchName ?? "" })}</p>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(save.error))}</p> : null}
      <div className="fixed inset-x-0 bottom-bottom-bar z-20 border-t bg-background p-3 md:static md:border-0 md:p-0">
        <Button type="submit" size="block" disabled={save.isPending || !!match}>
          {t("capture.save")}
        </Button>
      </div>
    </form>
  );
}

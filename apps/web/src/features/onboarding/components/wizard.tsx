"use client";

import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingList } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { whatsappLink } from "@gymos/api/contact-links";
import { formatDateTime } from "@gymos/api/format";
import { t, type MessageKey } from "@gymos/i18n";
import { activeSteps, initialAnswers, missingFields, resumeIndex, type Answers, type Responses } from "../steps";
import { fetchWizardState, submitStep } from "../queries/onboarding";
import { WizardField } from "./field";

const draftKey = (token: string, step: string) => `gymos:onboard:${token}:${step}`;
function readDraft(token: string, step: string): Answers | null {
  try {
    const raw = localStorage.getItem(draftKey(token, step));
    return raw ? (JSON.parse(raw) as Answers) : null;
  } catch {
    return null;
  }
}
function writeDraft(token: string, step: string, a: Answers | null) {
  try {
    if (a) localStorage.setItem(draftKey(token, step), JSON.stringify(a));
    else localStorage.removeItem(draftKey(token, step));
  } catch {
    /* private mode: the server copy is enough */
  }
}

/** Public onboarding wizard. Saves every step on the server; a refresh resumes at the first unsaved step. */
export function Wizard({ token }: { token: string }) {
  const state = useQuery({ queryKey: ["wizard", token], queryFn: () => fetchWizardState(token), staleTime: Infinity, retry: 1 });
  const [responses, setResponses] = useState<Responses>({});
  const [index, setIndex] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [invalid, setInvalid] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<MessageKey | null>(null);
  const [done, setDone] = useState<{ advisor: string | null; contact_by: string | null } | null>(null);

  const s = state.data;
  useEffect(() => {
    if (!s?.ok || index !== null) return;
    setResponses(s.responses);
    if (s.completed) setDone({ advisor: s.advisor, contact_by: s.contact_by });
    const i = resumeIndex(s.responses);
    setIndex(i);
    const step = activeSteps(s.responses)[i];
    setAnswers(readDraft(token, step.key) ?? initialAnswers(step, s.responses, s));
  }, [s, index, token]);

  if (state.isPending || (s?.ok && index === null)) return <LoadingList rows={3} label={t("common.loading")} />;
  if (state.isError) return <Message title={t("wizard.errorLoad")} body={t("error.retryHint")} action={<Button onClick={() => state.refetch()}>{t("common.retry")}</Button>} />;
  if (!s!.ok) {
    const phone = s!.branch_phone;
    return (
      <Message
        title={t(s!.reason === "closed" ? "wizard.closed" : "wizard.expired")}
        body={t("wizard.askAdvisor")}
        action={phone ? <a className={buttonVariants({ size: "block" })} href={whatsappLink(phone, t("wizard.resendText"))}><MessageCircle aria-hidden />{t("wizard.messageBranch", { branch: s!.branch_name ?? "" })}</a> : null}
      />
    );
  }
  if (done)
    return (
      <Message
        icon
        title={t("wizard.doneTitle")}
        body={done.advisor ? t("wizard.doneAdvisor", { advisor: done.advisor, when: done.contact_by ? formatDateTime(done.contact_by) : "" }) : t("wizard.doneNoAdvisor")}
      />
    );

  const prefill = s!; // narrowed: ok === true past the checks above
  const steps = activeSteps(responses);
  const step = steps[index!];
  const isLast = index === steps.length - 1;

  function change(name: string, v: Answers[string]) {
    const next = { ...answers, [name]: v };
    setAnswers(next);
    setInvalid((cur) => cur.filter((n) => n !== name));
    writeDraft(token, step.key, next);
  }

  async function next() {
    const missing = missingFields(step, answers);
    setInvalid(missing);
    if (missing.length) return document.getElementById(`f-${missing[0]}`)?.focus();
    setSaving(true);
    setError(null);
    try {
      const result = await submitStep(token, step.key, answers, isLast);
      if (!result.ok) return setError("wizard.expired");
      writeDraft(token, step.key, null);
      const nextResponses = { ...responses, [step.key]: answers };
      setResponses(nextResponses);
      if (isLast) return setDone({ advisor: result.advisor?.split(" ")[0] ?? null, contact_by: result.contact_by });
      const nextSteps = activeSteps(nextResponses);
      const ni = nextSteps.findIndex((x) => x.key === step.key) + 1;
      setIndex(ni);
      setAnswers(readDraft(token, nextSteps[ni].key) ?? initialAnswers(nextSteps[ni], nextResponses, prefill));
      window.scrollTo({ top: 0 });
    } catch {
      setError("wizard.errorSave");
    } finally {
      setSaving(false);
    }
  }

  function back() {
    const prev = steps[index! - 1];
    setIndex(index! - 1);
    setAnswers(readDraft(token, prev.key) ?? initialAnswers(prev, responses, prefill));
    setInvalid([]);
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void next(); }} noValidate className="grid gap-6 pb-32">
      <div className="grid gap-2">
        <p className="text-sm text-muted-foreground" data-testid="wizard-progress">{t("wizard.progress", { n: index! + 1, total: steps.length })}</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index! + 1}>
          <div className="h-full bg-primary transition-[width]" style={{ width: `${((index! + 1) / steps.length) * 100}%` }} />
        </div>
        <h1 className="text-xl font-semibold">{t(`wizard.step.${step.key}` as MessageKey)}</h1>
      </div>
      {step.fields.map((f) => <WizardField key={f.name} field={f} value={answers[f.name]} invalid={invalid.includes(f.name)} onChange={(v) => change(f.name, v)} />)}
      {error ? <p role="alert" className="text-sm text-destructive">{t(error)}</p> : null}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="mx-auto flex max-w-md gap-2">
          {index! > 0 ? <Button variant="outline" onClick={back} disabled={saving}>{t("wizard.back")}</Button> : null}
          <Button type="submit" className="flex-1" disabled={saving}>{saving ? t("wizard.saving") : isLast ? t("wizard.finish") : t("wizard.continue")}</Button>
        </div>
      </div>
    </form>
  );
}

function Message({ title, body, action, icon }: { title: string; body?: string; action?: React.ReactNode; icon?: boolean }) {
  return (
    <div className="grid gap-4 py-8 text-center" role="status">
      {icon ? <CheckCircle2 aria-hidden className="mx-auto size-12 text-success" /> : null}
      <h1 className="text-xl font-semibold">{title}</h1>
      {body ? <p className="text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

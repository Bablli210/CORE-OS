"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DayChips } from "@/features/sessions/components/day-chips";
import { prefWeekdays, WEEKDAY_CODES } from "@/features/sessions/week";
import { createClient } from "@/lib/supabase/client";
import { t, type MessageKey } from "@/lib/i18n";
import { clientKeys, updateProfile } from "../queries/client";

type Profile = {
  instagram_handle: string | null;
  onboarding_responses: { pt_prefs?: { days?: string[]; time?: string; trainer_gender?: string }; social?: { consent_marketing?: boolean; consent_content?: boolean } };
  language: "en" | "ar";
};

/** The member's own row (clients RLS: own) and language (profiles). Writes go through fn_update_my_profile. */
async function fetchProfile(): Promise<Profile> {
  const db = createClient();
  const [c, p] = await Promise.all([
    db.from("clients").select("instagram_handle, onboarding_responses").maybeSingle(),
    db.from("profiles").select("preferred_language").maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (p.error) throw p.error;
  return { ...(c.data as Omit<Profile, "language">), language: p.data?.preferred_language === "ar" ? "ar" : "en" };
}

const TIMES = ["morning", "afternoon", "evening"] as const;
const GENDERS = ["any", "female", "male"] as const;

/** /c/profile — preferences from onboarding (editable), Instagram handle, consents, language. Sign out is in the header. */
export function ProfileScreen() {
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: clientKeys.profile, queryFn: fetchProfile });
  if (q.isPending) return <LoadingList label={t("common.loading")} />;
  if (q.isError || !q.data) return <ErrorState title={t("profile.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => q.refetch()}>{t("common.retry")}</Button>} />;
  return <ProfileForm initial={q.data} onSaved={() => queryClient.invalidateQueries({ queryKey: clientKeys.all })} />;
}

function ProfileForm({ initial, onSaved }: { initial: Profile; onSaved: () => void }) {
  const prefs = initial.onboarding_responses.pt_prefs ?? {};
  const social = initial.onboarding_responses.social ?? {};
  const [days, setDays] = useState(prefWeekdays(prefs.days));
  const [time, setTime] = useState(prefs.time ?? "");
  const [gender, setGender] = useState(prefs.trainer_gender ?? "any");
  const [instagram, setInstagram] = useState(initial.instagram_handle ?? "");
  const [marketing, setMarketing] = useState(!!social.consent_marketing);
  const [content, setContent] = useState(!!social.consent_content);
  const [language, setLanguage] = useState<"en" | "ar">(initial.language);
  const save = useMutation({
    mutationFn: () => updateProfile({ pt_prefs: { days: days.map((d) => WEEKDAY_CODES[d]), time, trainer_gender: gender }, instagram: instagram.trim(), language, consent_marketing: marketing, consent_content: content }),
    onSuccess: onSaved,
  });

  return (
    <form className="grid max-w-xl gap-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
      <PageHeader title={t("profile.title")} description={t("profile.description")} />
      <Card>
        <CardHeader><CardTitle>{t("profile.training")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <DayChips label={t("profile.days")} value={days} onChange={setDays} />
          <Field label={t("profile.time")} htmlFor="pref-time">
            <Select id="pref-time" value={time} onChange={(e) => setTime(e.target.value)}>
              <option value="">{t("profile.noPreference")}</option>
              {TIMES.map((x) => <option key={x} value={x}>{t(`opt.${x}` as MessageKey)}</option>)}
            </Select>
          </Field>
          <Field label={t("profile.trainer")} htmlFor="pref-trainer">
            <Select id="pref-trainer" value={gender} onChange={(e) => setGender(e.target.value)}>
              {GENDERS.map((x) => <option key={x} value={x}>{t(`opt.${x}` as MessageKey)}</option>)}
            </Select>
          </Field>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>{t("profile.about")}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label={t("profile.instagram")} htmlFor="pref-ig"><Input id="pref-ig" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="@" /></Field>
          <label className="flex items-center justify-between gap-3 text-sm">{t("profile.consentMarketing")}<Switch checked={marketing} onCheckedChange={setMarketing} aria-label={t("profile.consentMarketing")} /></label>
          <label className="flex items-center justify-between gap-3 text-sm">{t("profile.consentContent")}<Switch checked={content} onCheckedChange={setContent} aria-label={t("profile.consentContent")} /></label>
          <Field label={t("profile.language")} htmlFor="pref-lang" hint={t("profile.languageHint")}>
            <Select id="pref-lang" value={language} onChange={(e) => setLanguage(e.target.value as "en" | "ar")}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </Select>
          </Field>
        </CardContent>
      </Card>
      <p role="status" className="min-h-5 text-sm text-success">{save.isSuccess ? t("profile.saved") : ""}</p>
      {save.isError ? <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p> : null}
      <Button type="submit" size="block" disabled={save.isPending}>{t("common.save")}</Button>
    </form>
  );
}

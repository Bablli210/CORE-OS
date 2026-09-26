"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { PhoneInput } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { t, type MessageKey } from "@gymos/i18n";
import { requestClientOtp, verifyClientOtp } from "../actions";
import { otpVerifySchema, type OtpVerify } from "@gymos/api/auth/login-schema";

/** Clients: phone → 6-digit code (WhatsApp, SMS fallback on production; 123456 locally). */
export function ClientLoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<MessageKey | null>(null);
  const form = useForm<OtpVerify>({ resolver: zodResolver(otpVerifySchema), defaultValues: { phone: "", token: "" } });
  const { errors } = form.formState;

  async function sendCode() {
    setError(null);
    const valid = await form.trigger("phone");
    if (!valid) return;
    startTransition(async () => {
      const result = await requestClientOtp({ phone: form.getValues("phone") });
      if (result.error) setError(result.error);
      else setStep("code");
    });
  }

  const onVerify = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await verifyClientOtp(values, next);
      if (result?.error) setError(result.error);
    }),
  );

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={(e) => {
        if (step === "phone") {
          e.preventDefault();
          void sendCode();
        } else void onVerify(e);
      }}
    >
      <Field label={t("login.phone")} htmlFor="phone" error={errors.phone && t(errors.phone.message as MessageKey)}>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => (
            <PhoneInput id="phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.phone} disabled={step === "code"} />
          )}
        />
      </Field>
      {step === "code" ? (
        <Field
          label={t("login.code")}
          htmlFor="token"
          hint={t("login.codeSent")}
          error={errors.token && t(errors.token.message as MessageKey)}
        >
          <Input id="token" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus aria-invalid={!!errors.token} {...form.register("token")} />
        </Field>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      <Button type="submit" size="block" disabled={pending}>
        {step === "phone" ? (pending ? t("login.sendingCode") : t("login.sendCode")) : pending ? t("login.signingIn") : t("login.verify")}
      </Button>
      {step === "code" ? (
        <Button variant="link" onClick={() => setStep("phone")}>
          {t("login.changeNumber")}
        </Button>
      ) : null}
    </form>
  );
}

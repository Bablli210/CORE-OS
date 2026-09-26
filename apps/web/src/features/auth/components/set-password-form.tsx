"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { t, type MessageKey } from "@gymos/i18n";
import { setPassword } from "../actions";
import { setPasswordSchema, type SetPassword } from "@gymos/api/auth/login-schema";

export function SetPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const form = useForm<SetPassword>({ resolver: zodResolver(setPasswordSchema), defaultValues: { password: "", confirm: "" } });
  const { errors } = form.formState;
  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await setPassword(values);
      if (result?.error) setError(result.error);
    }),
  );
  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field label={t("welcome.password")} htmlFor="password" hint={t("welcome.passwordHint")} error={errors.password && t(errors.password.message as MessageKey)}>
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      <Field label={t("welcome.confirm")} htmlFor="confirm" error={errors.confirm && t(errors.confirm.message as MessageKey)}>
        <Input id="confirm" type="password" autoComplete="new-password" aria-invalid={!!errors.confirm} {...form.register("confirm")} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      <Button type="submit" size="block" disabled={pending}>
        {t("welcome.submit")}
      </Button>
    </form>
  );
}

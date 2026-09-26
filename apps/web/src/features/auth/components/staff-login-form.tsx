"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { t, type MessageKey } from "@gymos/i18n";
import { signInStaff } from "../actions";
import { staffLoginSchema, type StaffLogin } from "@gymos/api/auth/login-schema";

export function StaffLoginForm({ next }: { next?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const form = useForm<StaffLogin>({ resolver: zodResolver(staffLoginSchema), defaultValues: { email: "", password: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await signInStaff(values, next);
      if (result?.error) setError(result.error);
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field label={t("login.email")} htmlFor="email" error={errors.email && t(errors.email.message as MessageKey)}>
        <Input id="email" type="email" autoComplete="username" inputMode="email" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label={t("login.password")} htmlFor="password" error={errors.password && t(errors.password.message as MessageKey)}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!errors.password} {...form.register("password")} />
      </Field>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : null}
      <Button type="submit" size="block" disabled={pending}>
        {pending ? t("login.signingIn") : t("login.signIn")}
      </Button>
    </form>
  );
}

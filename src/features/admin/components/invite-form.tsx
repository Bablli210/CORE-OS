"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { PhoneInput } from "@/components/phone-input";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { useMe } from "@/features/auth/me-context";
import { t, type MessageKey } from "@/lib/i18n";
import { inviteStaff } from "../actions";
import { peopleKeys } from "../queries/people";
import { inviteSchema, STAFF_ROLES, type InviteInput } from "../schemas/people";

/** Invite a staff member by email with their first role; they set a password from the email link. */
export function InviteForm({ onDone }: { onDone: () => void }) {
  const { branches } = useMe();
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<MessageKey | null>(null);
  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { fullName: "", email: "", phone: "", role: "sales_rep", branchId: branches[0]?.id ?? null },
  });
  const { errors } = form.formState;
  const role = form.watch("role");
  const msg = (m?: string) => (m ? t(m as MessageKey) : undefined);

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setError(null);
      const result = await inviteStaff({ ...values, branchId: values.role === "top_management" ? null : values.branchId });
      if (result.error) return setError(result.error);
      await queryClient.invalidateQueries({ queryKey: peopleKeys.all });
      onDone();
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <Field label={t("people.fullName")} htmlFor="invite-name" error={msg(errors.fullName?.message)}>
        <Input id="invite-name" autoComplete="off" aria-invalid={!!errors.fullName} {...form.register("fullName")} />
      </Field>
      <Field label={t("login.email")} htmlFor="invite-email" error={msg(errors.email?.message)}>
        <Input id="invite-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register("email")} />
      </Field>
      <Field label={t("people.phoneOptional")} htmlFor="invite-phone" error={msg(errors.phone?.message)}>
        <Controller
          control={form.control}
          name="phone"
          render={({ field }) => <PhoneInput id="invite-phone" value={field.value} onChange={field.onChange} onBlur={field.onBlur} invalid={!!errors.phone} />}
        />
      </Field>
      <Field label={t("people.role")} htmlFor="invite-role">
        <Select id="invite-role" {...form.register("role")}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}` as MessageKey)}
            </option>
          ))}
        </Select>
      </Field>
      {role !== "top_management" ? (
        <Field label={t("people.branch")} htmlFor="invite-branch" error={msg(errors.branchId?.message)}>
          <Select id="invite-branch" {...form.register("branchId")}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{t(error)}</p> : null}
      <Button type="submit" size="block" disabled={pending}>
        {pending ? t("people.sending") : t("people.sendInvite")}
      </Button>
    </form>
  );
}

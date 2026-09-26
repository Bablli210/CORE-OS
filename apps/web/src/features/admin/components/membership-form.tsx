"use client";

import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth/me-context";
import { t, type MessageKey } from "@gymos/i18n";
import { useSaveMembership } from "@gymos/api/admin/use-people";
import { peopleErrorKey, type PersonMembership } from "@gymos/api/admin/people";
import { COACHING_ROLES, DISCOUNT_ROLES, membershipSchema, STAFF_ROLES, type MembershipInput } from "@gymos/api/admin/people-schema";

type FormValues = Omit<MembershipInput, "specialties" | "capacity"> & { specialties: string; capacity: string };

/** Adds or edits one role of a person. Capacity/specialties only for coaching roles, discount allowance only for sales. */
export function MembershipForm({ profileId, membership, onDone }: { profileId: string; membership: PersonMembership | null; onDone: () => void }) {
  const { branches } = useMe();
  const save = useSaveMembership(profileId);
  const form = useForm<FormValues>({
    defaultValues: {
      role: (membership?.role as MembershipInput["role"]) ?? "sales_rep",
      branchId: membership?.branchId ?? branches[0]?.id ?? null,
      capacity: membership?.capacity?.toString() ?? "",
      specialties: membership?.specialties.join(", ") ?? "",
      discountAllowancePct: membership?.discountAllowancePct ?? 0,
      isActive: membership?.isActive ?? true,
    },
  });
  const role = form.watch("role");
  const coaching = COACHING_ROLES.includes(role);
  const idp = membership?.id ?? "new";

  const onSubmit = form.handleSubmit((v) => {
    const input = {
      ...v,
      branchId: v.role === "top_management" ? null : v.branchId,
      capacity: coaching && v.capacity !== "" ? Number(v.capacity) : null,
      specialties: coaching ? v.specialties.split(",").map((s) => s.trim()).filter(Boolean) : [],
      discountAllowancePct: DISCOUNT_ROLES.includes(v.role) ? Number(v.discountAllowancePct) : 0,
    };
    const parsed = membershipSchema.safeParse(input);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      form.setError((issue.path[0] as keyof FormValues) ?? "role", { message: issue.message });
      return;
    }
    save.mutate({ membershipId: membership?.id ?? null, input: parsed.data }, { onSuccess: onDone });
  });
  const err = (name: keyof FormValues) => {
    const m = form.formState.errors[name]?.message;
    return m ? t(m as MessageKey) : undefined;
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 rounded-lg border p-3">
      <Field label={t("people.role")} htmlFor={`role-${idp}`} error={err("role")}>
        <Select id={`role-${idp}`} {...form.register("role")}>
          {STAFF_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}` as MessageKey)}
            </option>
          ))}
        </Select>
      </Field>
      {role === "head_coach" ? <p className="text-sm text-muted-foreground">{t("people.headCoachNote")}</p> : null}
      {role !== "top_management" ? (
        <Field label={t("people.branch")} htmlFor={`branch-${idp}`} error={err("branchId")}>
          <Select id={`branch-${idp}`} {...form.register("branchId")}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {coaching ? (
        <>
          <Field label={t("people.capacity")} htmlFor={`capacity-${idp}`} hint={t("people.capacityHint")} error={err("capacity")}>
            <Input id={`capacity-${idp}`} type="number" inputMode="numeric" min={0} {...form.register("capacity")} />
          </Field>
          <Field label={t("people.specialties")} htmlFor={`spec-${idp}`} hint={t("people.specialtiesHint")}>
            <Input id={`spec-${idp}`} {...form.register("specialties")} />
          </Field>
        </>
      ) : null}
      {DISCOUNT_ROLES.includes(role) ? (
        <Field label={t("people.discount")} htmlFor={`disc-${idp}`} hint={t("people.discountHint")} error={err("discountAllowancePct")}>
          <Input id={`disc-${idp}`} type="number" inputMode="decimal" min={0} max={100} step="0.5" {...form.register("discountAllowancePct", { valueAsNumber: true })} />
        </Field>
      ) : null}
      {membership ? (
        <Controller
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-3">
              <span id={`active-${idp}`} className="text-sm font-medium">{t("people.roleActive")}</span>
              <Switch aria-labelledby={`active-${idp}`} checked={field.value} onCheckedChange={field.onChange} />
            </div>
          )}
        />
      ) : null}
      {save.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {t(peopleErrorKey(save.error))}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending} className="flex-1">
          {t("common.save")}
        </Button>
        <Button variant="outline" onClick={onDone}>
          {t("common.cancel")}
        </Button>
      </div>
    </form>
  );
}

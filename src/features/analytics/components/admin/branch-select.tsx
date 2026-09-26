"use client";

import { Select } from "@/components/ui/input";
import { useMe } from "@/features/auth/me-context";
import { t } from "@/lib/i18n";

/** Branch filter for the admin screens: all branches ("") or one. */
export function BranchSelect({ value, onChange, allowAll = true }: { value: string; onChange: (v: string) => void; allowAll?: boolean }) {
  const { branches } = useMe();
  return (
    <label>
      <span className="sr-only">{t("money.branch")}</span>
      <Select value={value} onChange={(e) => onChange(e.target.value)} className="w-48" data-testid="branch-select">
        {allowAll ? <option value="">{t("shell.allBranches")}</option> : null}
        {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </Select>
    </label>
  );
}

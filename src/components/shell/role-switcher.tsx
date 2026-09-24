"use client";

import { useMe } from "@/features/auth/me-context";
import { switcherOptions } from "@/features/auth/roles";
import { t, type MessageKey } from "@/lib/i18n";

/** Shown to people with more than one role or branch (Karim: sales manager A/B; Ahmed: head coach/coach). */
export function RoleSwitcher() {
  const me = useMe();
  const options = switcherOptions(me.memberships);
  if (options.length < 2) return null;
  return (
    <label className="flex items-center">
      <span className="sr-only">{t("shell.switchRole")}</span>
      <select
        value={me.active.id}
        onChange={(e) => window.location.assign(`/context/${e.target.value}`)}
        className="min-h-10 max-w-52 truncate rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:max-w-64"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {t(`role.${m.role}` as MessageKey)} · {m.branchName ?? t("shell.allBranches")}
          </option>
        ))}
      </select>
    </label>
  );
}

import { Badge } from "@/components/ui/badge";
import type { Branch } from "@/features/auth/me";
import { t, type MessageKey } from "@gymos/i18n";
import type { PersonMembership } from "@gymos/api/admin/people";

export function roleLabel(m: Pick<PersonMembership, "role" | "branchId">, branches: Branch[]) {
  const branch = m.branchId ? (branches.find((b) => b.id === m.branchId)?.code ?? "?") : t("shell.allBranches");
  return `${t(`role.${m.role}` as MessageKey)} · ${branch}`;
}

/** True for the coach membership the database adds alongside a head coach membership (same branch). */
export function isAutoCoach(m: PersonMembership, all: PersonMembership[]) {
  return m.role === "coach" && all.some((o) => o.role === "head_coach" && o.branchId === m.branchId && o.isActive);
}

export function RoleBadges({ memberships, branches }: { memberships: PersonMembership[]; branches: Branch[] }) {
  const staff = memberships.filter((m) => m.role !== "client" && m.isActive);
  if (staff.length === 0) return <span className="text-sm text-muted-foreground">{t("people.noRoles")}</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {staff.map((m) => (
        <Badge key={m.id} variant="outline">
          {roleLabel(m, branches)}
        </Badge>
      ))}
    </span>
  );
}

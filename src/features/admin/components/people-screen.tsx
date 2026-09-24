"use client";

import { Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingList } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { useMe } from "@/features/auth/me-context";
import { t, type MessageKey } from "@/lib/i18n";
import { usePeople } from "../hooks/use-people";
import type { Person } from "../queries/people";
import { STAFF_ROLES } from "../schemas/people";
import { InviteForm } from "./invite-form";
import { PersonSheet } from "./person-sheet";
import { RoleBadges } from "./role-badges";

/** /admin/people: every staff member, their roles per branch; invite, edit roles, deactivate. */
export function PeopleScreen() {
  const { branches } = useMe();
  const { data, isPending, isError, refetch } = usePeople();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);

  const people = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (p) =>
        (!q || [p.fullName, p.email, p.phone].some((v) => v?.toLowerCase().includes(q))) &&
        (!role || p.memberships.some((m) => m.role === role && m.isActive)),
    );
  }, [data, query, role]);
  const open = data?.find((p) => p.id === openId) ?? null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-2 md:flex-row">
        <label className="relative flex-1">
          <span className="sr-only">{t("common.search")}</span>
          <Search aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("people.search")} className="ps-9" type="search" />
        </label>
        <label className="md:w-56">
          <span className="sr-only">{t("people.filterRole")}</span>
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">{t("people.allRoles")}</option>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`role.${r}` as MessageKey)}
              </option>
            ))}
          </Select>
        </label>
        <Button onClick={() => setInviting(true)} className="fixed inset-x-4 bottom-20 z-20 md:static md:inset-auto">
          <UserPlus aria-hidden />
          {t("people.invite")}
        </Button>
      </div>

      {isPending ? (
        <LoadingList label={t("common.loading")} />
      ) : isError ? (
        <ErrorState title={t("people.error.load")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />
      ) : people.length === 0 ? (
        <EmptyState
          icon={Users}
          title={data.length === 0 ? t("people.empty") : t("people.noMatch")}
          action={data.length === 0 ? <Button onClick={() => setInviting(true)}>{t("people.invite")}</Button> : <Button variant="outline" onClick={() => { setQuery(""); setRole(""); }}>{t("common.clearFilters")}</Button>}
        />
      ) : (
        <PeopleList people={people} branches={branches} onOpen={setOpenId} />
      )}

      <Sheet open={inviting} onClose={() => setInviting(false)} title={t("people.invite")} closeLabel={t("common.close")}>
        <InviteForm onDone={() => setInviting(false)} />
      </Sheet>
      <Sheet open={!!open} onClose={() => setOpenId(null)} title={open?.fullName ?? ""} closeLabel={t("common.close")}>
        {open ? <PersonSheet person={open} /> : null}
      </Sheet>
    </div>
  );
}

/** Table on desktop, cards below md (CLAUDE.md rule 7). */
function PeopleList({ people, branches, onOpen }: { people: Person[]; branches: ReturnType<typeof useMe>["branches"]; onOpen: (id: string) => void }) {
  return (
    <>
      <ul className="grid gap-2 md:hidden">
        {people.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onOpen(p.id)} className="grid w-full gap-2 rounded-lg border p-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.fullName}</span>
                {!p.isActive ? <Badge variant="destructive">{t("people.inactive")}</Badge> : null}
              </span>
              <span className="text-sm text-muted-foreground">{p.email ?? p.phone}</span>
              <RoleBadges memberships={p.memberships} branches={branches} />
            </button>
          </li>
        ))}
      </ul>
      <table className="hidden w-full text-sm md:table">
        <thead className="text-start text-muted-foreground">
          <tr className="border-b">
            <th className="py-2 text-start font-medium">{t("people.col.name")}</th>
            <th className="py-2 text-start font-medium">{t("people.col.contact")}</th>
            <th className="py-2 text-start font-medium">{t("people.col.roles")}</th>
            <th className="py-2 text-start font-medium">{t("people.col.status")}</th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className="border-b last:border-0">
              <td className="py-2">
                <button type="button" onClick={() => onOpen(p.id)} className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {p.fullName}
                </button>
              </td>
              <td className="py-2 text-muted-foreground">
                <span className="grid">
                  <span>{p.email}</span>
                  <span dir="ltr" className="text-start">{p.phone}</span>
                </span>
              </td>
              <td className="py-2">
                <RoleBadges memberships={p.memberships} branches={branches} />
              </td>
              <td className="py-2">{p.isActive ? <Badge variant="success">{t("people.active")}</Badge> : <Badge variant="destructive">{t("people.inactive")}</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

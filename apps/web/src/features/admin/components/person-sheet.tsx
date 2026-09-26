"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-context";
import { t } from "@gymos/i18n";
import { useSetPersonActive } from "@gymos/api/admin/use-people";
import { peopleErrorKey, type Person } from "@gymos/api/admin/people";
import { MembershipForm } from "./membership-form";
import { isAutoCoach, roleLabel } from "./role-badges";

/** One person: contact, every role (edit / add), deactivate. */
export function PersonSheet({ person }: { person: Person }) {
  const me = useMe();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const setActive = useSetPersonActive(person.id);
  const staff = person.memberships.filter((m) => m.role !== "client");

  return (
    <div className="grid gap-4">
      <div className="grid gap-1 text-sm">
        {person.email ? <span>{person.email}</span> : null}
        {person.phone ? <span dir="ltr" className="text-start text-muted-foreground">{person.phone}</span> : null}
        {!person.isActive ? <Badge variant="destructive" className="w-fit">{t("people.inactive")}</Badge> : null}
      </div>

      <section className="grid gap-2" aria-labelledby="roles-heading">
        <h3 id="roles-heading" className="text-sm font-semibold">{t("people.roles")}</h3>
        {staff.length === 0 ? <p className="text-sm text-muted-foreground">{t("people.noRoles")}</p> : null}
        <ul className="grid gap-2">
          {staff.map((m) =>
            editing === m.id ? (
              <li key={m.id}>
                <MembershipForm profileId={person.id} membership={m} onDone={() => setEditing(null)} />
              </li>
            ) : (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-3" data-testid="membership-row">
                <span className="grid gap-1">
                  <span className="font-medium">{roleLabel(m, me.branches)}</span>
                  <span className="flex flex-wrap gap-1">
                    {!m.isActive ? <Badge variant="destructive">{t("people.inactive")}</Badge> : null}
                    {isAutoCoach(m, person.memberships) ? <Badge>{t("people.autoCoach")}</Badge> : null}
                    {m.capacity !== null ? <Badge variant="outline">{t("people.capacityValue", { n: m.capacity })}</Badge> : null}
                  </span>
                </span>
                <Button variant="outline" size="sm" onClick={() => setEditing(m.id)}>
                  {t("common.edit")}
                </Button>
              </li>
            ),
          )}
        </ul>
        {editing === "new" ? (
          <MembershipForm profileId={person.id} membership={null} onDone={() => setEditing(null)} />
        ) : (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus aria-hidden />
            {t("people.addRole")}
          </Button>
        )}
      </section>

      {person.id !== me.profile.id ? (
        <section className="grid gap-2 border-t pt-4">
          {setActive.isError ? <p role="alert" className="text-sm text-destructive">{t(peopleErrorKey(setActive.error))}</p> : null}
          {person.isActive ? (
            confirming ? (
              <div className="grid gap-2">
                <p className="text-sm">{t("people.deactivateConfirm", { name: person.fullName })}</p>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" disabled={setActive.isPending} onClick={() => setActive.mutate(false, { onSuccess: () => setConfirming(false) })}>
                    {t("people.deactivate")}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirming(false)}>{t("common.cancel")}</Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirming(true)}>{t("people.deactivate")}</Button>
            )
          ) : (
            <Button variant="outline" disabled={setActive.isPending} onClick={() => setActive.mutate(true)}>{t("people.reactivate")}</Button>
          )}
        </section>
      ) : null}
    </div>
  );
}

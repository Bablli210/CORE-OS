"use client";

import { X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useAudit } from "../../hooks/use-analytics";
import { useSetParams } from "../../hooks/use-set-params";
import { AuditDiff } from "./audit-diff";

/**
 * /admin/audit (docs/04): the events stream and audit_log (fn_audit_explorer), filtered by table, actor, dates and text,
 * newest first, 200 at a time. Every row expands to its diff. Filters live in the URL, so a filtered view can be shared.
 */
export function AuditExplorer() {
  const params = useSearchParams();
  const setParams = useSetParams();
  const f = {
    source: (params.get("source") === "audit" ? "audit" : "events") as "events" | "audit",
    table: params.get("table") ?? "",
    actor: params.get("actor") ?? "",
    from: params.get("from") ?? "",
    to: params.get("to") ?? "",
    search: params.get("search") ?? "",
  };
  const audit = useAudit(f);
  const actorName = audit.data?.rows.find((r) => r.actor_id === f.actor)?.actor ?? t("audit.actor");

  return (
    <div className="grid min-w-0 gap-4 [&>*]:min-w-0">
      <PageHeader title={t("screen.admin.audit.title")} description={t("audit.description")} />
      <form className="grid grid-cols-2 gap-2 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); setParams({ search: String(new FormData(e.currentTarget).get("search") ?? "") }); }}>
        <label className="grid gap-1 text-xs">{t("audit.source")}
          <Select value={f.source} onChange={(e) => setParams({ source: e.target.value, table: null })} data-testid="audit-source">
            <option value="events">{t("audit.events")}</option>
            <option value="audit">{t("audit.auditLog")}</option>
          </Select>
        </label>
        <label className="grid gap-1 text-xs">{t("audit.table")}
          <Select value={f.table} onChange={(e) => setParams({ table: e.target.value })} data-testid="audit-table">
            <option value="">{t("audit.allTables")}</option>
            {(audit.data?.tables ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </label>
        <label className="grid gap-1 text-xs">{t("audit.from")}<Input type="date" value={f.from} onChange={(e) => setParams({ from: e.target.value })} /></label>
        <label className="grid gap-1 text-xs">{t("audit.to")}<Input type="date" value={f.to} onChange={(e) => setParams({ to: e.target.value })} /></label>
        <label className="col-span-2 grid gap-1 text-xs">{t("audit.search")}
          <span className="flex gap-2"><Input name="search" defaultValue={f.search} key={f.search} placeholder={t("audit.searchHint")} /><Button type="submit" variant="outline">{t("audit.apply")}</Button></span>
        </label>
      </form>
      {f.actor ? (
        <Badge variant="outline" className="justify-self-start gap-1">
          {t("audit.byActor", { name: actorName })}
          <button type="button" aria-label={t("audit.clearActor")} onClick={() => setParams({ actor: null })}><X className="size-3" aria-hidden /></button>
        </Badge>
      ) : null}
      {audit.isPending ? <LoadingList label={t("common.loading")} /> : audit.isError ? (
        <ErrorState title={t("audit.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => audit.refetch()}>{t("common.retry")}</Button>} />
      ) : audit.data.rows.length === 0 ? (
        <EmptyState title={t("audit.empty")} body={t("audit.emptyBody")} />
      ) : (
        <ul className="grid gap-2" data-testid="audit-rows">
          {audit.data.rows.map((r) => (
            <li key={`${f.source}-${r.id}`} className="rounded-lg border" data-testid="audit-row" data-kind={r.kind}>
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 p-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{formatDateTime(r.occurred_at)}</span>
                  <span className="font-medium">{r.kind}</span>
                  {r.action ? <Badge variant="outline">{r.action}</Badge> : null}
                  <span className="ms-auto text-muted-foreground">
                    {r.actor_id ? (
                      <button type="button" className="underline-offset-2 hover:underline" onClick={(e) => { e.preventDefault(); setParams({ actor: r.actor_id }); }}>{r.actor}</button>
                    ) : t("audit.system")}
                  </span>
                </summary>
                <div className="grid gap-2 border-t p-3">
                  {r.row_id ? <p className="break-all font-mono text-xs text-muted-foreground">{t("audit.rowId", { id: r.row_id })}</p> : null}
                  <AuditDiff oldRow={r.old_row} newRow={r.new_row} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
      {audit.data && audit.data.rows.length >= 200 ? <p className="text-xs text-muted-foreground">{t("audit.capped")}</p> : null}
    </div>
  );
}

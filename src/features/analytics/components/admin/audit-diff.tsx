import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const show = (v: unknown) => (v === undefined ? "" : typeof v === "string" ? v : JSON.stringify(v));

/**
 * Old vs new, one line per changed key (audit_log), or the payload (events, no old row). Changed values are marked with
 * a sign as well as colour, so the diff reads without it.
 */
export function AuditDiff({ oldRow, newRow }: { oldRow: Record<string, unknown> | null; newRow: Record<string, unknown> | null }) {
  const keys = Array.from(new Set([...Object.keys(oldRow ?? {}), ...Object.keys(newRow ?? {})])).sort();
  const changed = oldRow && newRow ? keys.filter((k) => show(oldRow[k]) !== show(newRow[k])) : keys;
  if (changed.length === 0) return <p className="text-xs text-muted-foreground">{t("audit.noChange")}</p>;
  return (
    <table className="w-full table-fixed text-xs" data-testid="audit-diff">
      <thead><tr className="text-muted-foreground">
        <th scope="col" className="w-1/4 text-start font-normal">{t("audit.field")}</th>
        {oldRow ? <th scope="col" className="text-start font-normal">{t("audit.before")}</th> : null}
        <th scope="col" className="text-start font-normal">{oldRow ? t("audit.after") : t("audit.payload")}</th>
      </tr></thead>
      <tbody>{changed.map((k) => (
        <tr key={k} className="border-t align-top">
          <th scope="row" className="break-all py-1 pe-2 text-start font-mono font-normal">{k}</th>
          {oldRow ? <td className={cn("break-all py-1 pe-2 font-mono", newRow && "text-destructive")}>{oldRow && newRow ? "− " : ""}{show(oldRow[k])}</td> : null}
          <td className={cn("break-all py-1 font-mono", oldRow && "text-success")}>{oldRow && newRow ? "+ " : ""}{show(newRow?.[k])}</td>
        </tr>
      ))}</tbody>
    </table>
  );
}

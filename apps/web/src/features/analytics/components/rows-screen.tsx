"use client";

import { ArrowLeft, Flag } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState, ErrorState, LoadingList, PageHeader } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cairoMonth, formatDateTime } from "@/lib/format";
import { t, type MessageKey } from "@/lib/i18n";
import { formatMetric, rowAmountUnit, rowsUnit } from "../format";
import { useRows } from "../hooks/use-analytics";

/**
 * /numbers/rows — the rows behind a tile (docs/05 M6: every tile clicks through). The footer's count / total is computed
 * by the database from the same rows, and equals the tile.
 */
export function RowsScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const metric = params.get("metric") ?? "";
  const month = params.get("month") ?? cairoMonth();
  const scope = params.get("scope");
  const extra = Object.fromEntries(["dow", "hr"].filter((k) => params.has(k)).map((k) => [k, Number(params.get(k))]));
  const rows = useRows(metric, month, scope, extra);
  const unit = rowsUnit(metric);
  const title = metric === "heatmap.cell" ? t("rows.heatmapTitle", { day: t(`weekday.${extra.dow}` as MessageKey), hour: String(extra.hr).padStart(2, "0") }) : t(`metric.${metric}` as MessageKey);

  return (
    <div className="grid gap-4">
      <Button variant="ghost" className="justify-self-start" onClick={() => router.back()}><ArrowLeft aria-hidden className="rtl:rotate-180" />{t("rows.back")}</Button>
      <PageHeader title={title} description={t("rows.description", { month })} />
      {rows.isPending ? <LoadingList label={t("common.loading")} /> : rows.isError || !rows.data ? (
        <ErrorState title={t("rows.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => rows.refetch()}>{t("common.retry")}</Button>} />
      ) : (
        <>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="rows-summary">
            <span>{t("rows.count", { n: rows.data.count })}</span>
            <span className="font-semibold" data-testid="rows-total" data-total={rows.data.total ?? ""}>{t("rows.total", { value: formatMetric(unit, rows.data.total) })}</span>
          </p>
          {rows.data.count === 0 ? <EmptyState title={t("rows.empty")} body={t("rows.emptyBody")} /> : (
            <ul className="grid gap-1" aria-label={title}>
              {rows.data.rows.map((r, i) => (
                <li key={`${r.row_id}-${i}`} data-testid="metric-row" className="grid gap-1 rounded-md border p-2 text-sm md:grid-cols-[10rem_1fr_1fr_8rem] md:items-center">
                  <span className="text-muted-foreground">{r.at ? formatDateTime(r.at) : "—"}</span>
                  <span className="font-medium">{r.label ?? "—"}</span>
                  <span className="flex items-center gap-1 text-muted-foreground">{r.flag ? <Flag aria-hidden className="size-3" /> : null}{r.detail ?? ""}</span>
                  <span className="tabular-nums md:text-end">{r.amount === null ? "" : formatMetric(rowAmountUnit(metric), rowAmountUnit(metric) === "money" ? Math.round(Number(r.amount)) : Number(r.amount))}</span>
                </li>
              ))}
            </ul>
          )}
          {rows.data.count > rows.data.rows.length ? <Badge variant="outline">{t("rows.capped", { shown: rows.data.rows.length, n: rows.data.count })}</Badge> : null}
        </>
      )}
    </div>
  );
}

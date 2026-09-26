"use client";

import Link from "next/link";
import { useMe } from "@/features/auth/me-context";
import { t, type MessageKey } from "@/lib/i18n";
import { formatMetric } from "../../format";
import { useTiles } from "../../hooks/use-analytics";
import { rowsHref, type Tile } from "../../queries/analytics";

/**
 * Branch A vs B vs all, one row per admin tile (fn_dashboard_tiles 'admin' per branch). Every figure is a link to its rows
 * for that branch, like the tiles.
 */
export function BranchCompare({ month }: { month: string }) {
  const { branches } = useMe();
  const a = useTiles("admin", month, branches[0]?.id ?? null, !!branches[0]);
  const b = useTiles("admin", month, branches[1]?.id ?? null, !!branches[1]);
  const all = useTiles("admin", month, null);
  const cols = [
    { id: branches[0]?.id ?? null, name: branches[0]?.name ?? "", tiles: a.data?.tiles },
    { id: branches[1]?.id ?? null, name: branches[1]?.name ?? "", tiles: b.data?.tiles },
    { id: null, name: t("shell.allBranches"), tiles: all.data?.tiles },
  ].filter((c) => c.name);
  const keys = all.data?.tiles.map((x) => x.key) ?? [];
  if (a.isError || b.isError || all.isError) return <p role="alert" className="text-sm text-destructive">{t("error.retryHint")}</p>;
  if (keys.length === 0) return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  const cell = (tiles: Tile[] | undefined, key: string) => tiles?.find((x) => x.key === key);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid="branch-compare">
        <thead>
          <tr className="text-muted-foreground">
            <th scope="col" className="py-1 text-start font-normal">{t("compare.metric")}</th>
            {cols.map((c) => <th key={c.id ?? "all"} scope="col" className="py-1 text-end font-normal">{c.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {keys.map((key) => (
            <tr key={key} className="border-t">
              <th scope="row" className="py-1.5 pe-2 text-start font-normal">{t(`metric.${key}` as MessageKey)}</th>
              {cols.map((c) => {
                const tile = cell(c.tiles, key);
                return (
                  <td key={c.id ?? "all"} className="whitespace-nowrap py-1.5 ps-2 text-end tabular-nums">
                    {tile ? (
                      <Link href={rowsHref(key, month, c.id)} className="underline-offset-2 hover:underline" data-testid="compare-cell" data-key={key} data-scope={c.id ?? ""} data-value={tile.value ?? ""}>
                        {formatMetric(tile.unit, tile.value)}
                      </Link>
                    ) : "…"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

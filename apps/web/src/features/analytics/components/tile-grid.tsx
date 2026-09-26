import { formatEGP } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { rowsHref, type Tile } from "@gymos/api/analytics/analytics";
import { StatTile } from "./stat-tile";

/** One line of context under a tile, from numbers the database returned with it. */
function tileSub(tile: Tile): string | undefined {
  const s = tile.sub;
  if (!s) return tile.live ? t("tile.now") : undefined;
  if (tile.key === "coach.commission") return t("tile.sub.commission", { net: formatEGP(s.net ?? 0), pct: s.pct ?? 0 });
  if (tile.key === "coach.retention") return t("tile.sub.retention", { renewed: s.renewed ?? 0, ended: s.ended ?? 0 });
  if (tile.key.endsWith(".conversion")) return t("tile.sub.conversion", { won: s.won ?? 0, leads: s.leads ?? 0 });
  if (tile.key.endsWith(".commission")) return t("tile.sub.salesCommission", { pct: s.pct ?? 0 });
  return undefined;
}

/** The tiles of a screen, each linking to its rows for the same month and scope. */
export function TileGrid({ tiles, month, scope, columns = "md:grid-cols-4" }: { tiles: Tile[]; month: string; scope: string | null; columns?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-3 ${columns}`}>
      {tiles.map((tile) => (
        <StatTile key={tile.key} tile={tile} href={rowsHref(tile.key, month, scope)} sub={tileSub(tile)} />
      ))}
    </div>
  );
}

import { formatDateTime } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { eventLabel } from "@gymos/api/deals/labels";
import type { Deal } from "@gymos/api/deals/deals";

export function DealTimeline({ events }: { events: Deal["timeline"] }) {
  if (!events.length) return <p className="text-sm text-muted-foreground">{t("deal.noEvents")}</p>;
  return (
    <ol className="grid gap-2 border-s ps-4" data-testid="deal-timeline">
      {events.map((e, i) => (
        <li key={i} className="grid">
          <span className="text-sm font-medium">{t(eventLabel(e.type))}</span>
          <span className="text-xs text-muted-foreground">{formatDateTime(e.occurred_at)}{e.actor ? ` · ${e.actor}` : ""}</span>
        </li>
      ))}
    </ol>
  );
}

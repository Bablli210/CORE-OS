import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { touchLabel } from "../labels";
import type { LeadDetail } from "../queries/leads";

export function TouchTimeline({ touches }: { touches: LeadDetail["touches"] }) {
  if (!touches.length) return <p className="text-sm text-muted-foreground">{t("touch.none")}</p>;
  return (
    <ol className="grid gap-3 border-s ps-4" data-testid="touch-timeline">
      {touches.map((x) => (
        <li key={x.id} className="grid gap-0.5">
          <span className="text-sm font-medium">
            {t(touchLabel(x.type))} · {t(x.direction === "inbound" ? "touch.inbound" : "touch.outbound")}
          </span>
          {x.note ? <span className="text-sm">{x.note}</span> : null}
          <span className="text-xs text-muted-foreground">{formatDateTime(x.occurred_at)} · {x.by_name}</span>
        </li>
      ))}
    </ol>
  );
}

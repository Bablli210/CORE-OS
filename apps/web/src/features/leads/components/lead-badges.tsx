import { Badge } from "@/components/ui/badge";
import { shortDuration } from "@gymos/api/format";
import { t } from "@gymos/i18n";
import { stageLabel, type LeadStatus } from "@gymos/api/leads/labels";
import type { SlaState } from "@gymos/api/leads/leads";

export function StageBadge({ status }: { status: LeadStatus }) {
  const variant = status === "won" ? "success" : status === "lost" ? "destructive" : "outline";
  return <Badge variant={variant}>{t(stageLabel(status))}</Badge>;
}

/** First-contact SLA: countdown while due, "breached" once past, nothing once met. */
export function SlaBadge({ state, dueAt }: { state: SlaState; dueAt: string | null }) {
  if (state === "breached") return <Badge variant="destructive">{t("sla.breached", { time: dueAt ? shortDuration(Date.now() - new Date(dueAt).getTime()) : "" })}</Badge>;
  if (state === "due" && dueAt) return <Badge variant="warning">{t("sla.due", { time: shortDuration(new Date(dueAt).getTime() - Date.now()) })}</Badge>;
  if (state === "late") return <Badge variant="outline">{t("sla.late")}</Badge>;
  return null;
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ErrorState, LoadingList } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/features/auth/me-context";
import { useSalesMutation } from "@/features/leads/hooks/use-leads";
import { setRotationPaused } from "@/features/leads/queries/leads";
import { salesErrorKey } from "@/features/leads/errors";
import { cairoMonth, formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import { useTeam } from "../hooks/use-sales";

/** /sales/team (sales manager): each rep's month from mv_rep_month, open flags, overdue, rotation on/off. */
export function TeamScreen() {
  const me = useMe();
  const branchId = me.active.branchId ?? "";
  const month = cairoMonth();
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useTeam(branchId, month);
  const toggle = useSalesMutation(({ id, paused }: { id: string; paused: boolean }) => setRotationPaused(id, paused));

  if (isPending) return <LoadingList label={t("common.loading")} />;
  if (isError) return <ErrorState title={t("team.error")} body={t("error.retryHint")} action={<Button variant="outline" onClick={() => refetch()}>{t("common.retry")}</Button>} />;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("team.refreshNote")}</p>
      {toggle.isError ? <p role="alert" className="text-sm text-destructive">{t(salesErrorKey(toggle.error))}</p> : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {data.map((r) => (
          <li key={r.membership_id} data-testid="team-rep" className="grid gap-3 rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{r.full_name}</span>
              <span className="flex items-center gap-2 text-sm">
                <span id={`rot-${r.membership_id}`}>{r.rotation_paused ? t("team.paused") : t("team.inRotation")}</span>
                <Switch
                  aria-label={t("team.rotationFor", { name: r.full_name })}
                  checked={!r.rotation_paused}
                  disabled={toggle.isPending}
                  onCheckedChange={(on) => toggle.mutate({ id: r.membership_id, paused: !on }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sales", "team"] }) })}
                />
              </span>
            </div>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              {[
                [t("team.leads"), r.leads],
                [t("team.contacted"), r.contacted],
                [t("team.onboarded"), r.onboarded],
                [t("team.quoted"), r.quoted],
                [t("team.won"), r.won],
                [t("team.conversion"), `${r.conversion_pct}%`],
                [t("team.response"), r.median_response_min === null ? "—" : `${r.median_response_min}m`],
                [t("team.overdue"), r.overdue_follow_ups],
                [t("team.flags"), r.open_flags],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-md bg-muted p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm">
              {t("team.revenue", { won: formatEGP(r.won_revenue), target: r.target_won_revenue ? formatEGP(Number(r.target_won_revenue)) : "—" })}
            </p>
            <p className="text-xs text-muted-foreground">{t("team.commission", { collected: formatEGP(r.membership_collected), commission: formatEGP(r.commission_piastres) })}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

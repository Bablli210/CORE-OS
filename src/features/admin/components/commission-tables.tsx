import { formatEGP } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { CommissionReport } from "../queries/money";

const th = "py-2 pe-3 text-start font-medium";
const td = "py-2 pe-3";

/** Payroll view of what mv_coach_month / mv_rep_month computed. Per-session values come from the server. */
export function CommissionTables({ report }: { report: CommissionReport }) {
  return (
    <div className="grid gap-6">
      <section aria-labelledby="comm-coaches" className="grid gap-2 overflow-x-auto">
        <h2 id="comm-coaches" className="font-semibold">{t("money.coachCommission")}</h2>
        <p className="text-sm text-muted-foreground">{t("money.coachFormula", { tax: report.tax_pct, net: 100 - report.tax_pct })}</p>
        <table className="w-full min-w-[40rem] text-sm" data-testid="coach-commission">
          <thead className="text-muted-foreground"><tr className="border-b">
            <th className={th}>{t("money.coach")}</th><th className={th}>{t("money.burned")}</th><th className={th}>{t("money.perSession")}</th>
            <th className={th}>{t("money.deliveredNet")}</th><th className={th}>{t("money.tier")}</th><th className={th}>{t("money.commission")}</th>
          </tr></thead>
          <tbody>
            {report.coaches.map((c) => (
              <tr key={c.membership_id} className="border-b last:border-0" data-testid="coach-row" data-gross={c.per_session_piastres ?? ""} data-net={c.net_per_session_piastres ?? ""}>
                <td className={td}>{c.full_name}</td>
                <td className={td}>{c.sessions_burned}</td>
                <td className={td}>{c.per_session_piastres ? `${formatEGP(c.per_session_piastres)} → ${formatEGP(c.net_per_session_piastres ?? 0)}` : "—"}</td>
                <td className={td}>{formatEGP(c.delivered_net_piastres)}</td>
                <td className={td}>{c.commission_pct}%</td>
                <td className={`${td} font-medium`}>{formatEGP(c.commission_piastres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section aria-labelledby="comm-reps" className="grid gap-2 overflow-x-auto">
        <h2 id="comm-reps" className="font-semibold">{t("money.repCommission")}</h2>
        <p className="text-sm text-muted-foreground">{t("money.repFormula", { pct: report.membership_pct, nutrition: report.nutrition_pct })}</p>
        <table className="w-full min-w-[36rem] text-sm" data-testid="rep-commission">
          <thead className="text-muted-foreground"><tr className="border-b">
            <th className={th}>{t("money.rep")}</th><th className={th}>{t("money.wonRevenue")}</th><th className={th}>{t("money.membershipCollected")}</th>
            <th className={th}>{t("money.nutritionCollected")}</th><th className={th}>{t("money.commission")}</th>
          </tr></thead>
          <tbody>
            {report.reps.map((r) => (
              <tr key={r.membership_id} className="border-b last:border-0">
                <td className={td}>{r.full_name}</td><td className={td}>{formatEGP(r.won_revenue_piastres)}</td><td className={td}>{formatEGP(r.membership_collected_piastres)}</td>
                <td className={td}>{formatEGP(r.nutrition_collected_piastres)}</td><td className={`${td} font-medium`}>{formatEGP(r.commission_piastres)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

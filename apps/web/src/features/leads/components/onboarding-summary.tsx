import type { Json } from "@/lib/database.types";
import { t, type MessageKey } from "@/lib/i18n";
import { formatDate } from "@/lib/format";

type Responses = Record<string, Record<string, Json>>;

const SECTIONS = ["identity", "goal", "interest", "pt_prefs", "health", "experience", "social"] as const;

function show(value: Json): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? t("common.yes") : t("common.no");
  if (Array.isArray(value)) return value.length ? value.map((v) => optionLabel(String(v))).join(", ") : "—";
  if (typeof value === "object") return Object.entries(value).filter(([, v]) => v === true).length + " / " + Object.keys(value).length + " " + t("onboardSummary.yesAnswers");
  return optionLabel(String(value));
}

/** Values like "fat_loss" or "morning" have a label under opt.*; free text is shown as typed. */
function optionLabel(v: string) {
  const key = `opt.${v}` as MessageKey;
  const label = t(key);
  return label === key ? v : label;
}

/** Readable summary of the wizard answers (docs/03 §2 schema v1), with the raw JSON one tap away. */
/** `completedAt` undefined (a client's copy of the answers) hides the completed/partial line. */
export function OnboardingSummary({ responses, completedAt }: { responses: Responses; completedAt?: string | null }) {
  const sections = SECTIONS.filter((s) => responses[s] && Object.keys(responses[s]).length);
  if (!sections.length) return <p className="text-sm text-muted-foreground">{t("onboardSummary.none")}</p>;
  return (
    <div className="grid gap-4" data-testid="onboarding-summary">
      {completedAt === undefined ? null : completedAt ? <p className="text-sm text-muted-foreground">{t("onboardSummary.completed", { date: formatDate(completedAt) })}</p> : <p className="text-sm text-warning-foreground">{t("onboardSummary.partial")}</p>}
      <dl className="grid gap-4 md:grid-cols-2">
        {sections.map((s) => (
          <div key={s} className="grid gap-1 rounded-md border p-3">
            <dt className="text-sm font-semibold">{t(`wizard.step.${s}` as MessageKey)}</dt>
            {Object.entries(responses[s]).map(([k, v]) => (
              <dd key={k} className="flex justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{t(`field.${k}` as MessageKey)}</span>
                <span className="text-end">{show(v)}</span>
              </dd>
            ))}
          </div>
        ))}
      </dl>
      <details>
        <summary className="cursor-pointer text-sm text-muted-foreground">{t("onboardSummary.raw")}</summary>
        <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs" dir="ltr">{JSON.stringify(responses, null, 2)}</pre>
      </details>
    </div>
  );
}

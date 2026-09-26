"use client";

import Link from "next/link";
import { Check, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@gymos/i18n";
import type { Guide } from "@gymos/api/guide/guides";
import { cn } from "@/lib/utils";

/** The guide: numbered steps, each with a link to where it's done and a tick; progress across the top. */
export function GuideCard({
  guide,
  done,
  auto,
  onToggle,
  onHide,
  framed = true,
}: {
  guide: Guide;
  done: Set<string>;
  auto: Set<string>;
  onToggle: (id: string) => void;
  onHide?: () => void;
  framed?: boolean;
}) {
  const isDone = (id: string, check?: string) => (check ? auto.has(check) : done.has(id));
  const count = guide.steps.filter((s) => isDone(s.id, s.check)).length;
  const all = count === guide.steps.length;
  return (
    <section aria-labelledby={`guide-${guide.id}`} data-testid="getting-started" className={cn("grid gap-4", framed && "rounded-lg border bg-card p-4 md:p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("guide.label")}</p>
          <h2 id={`guide-${guide.id}`} className="text-lg font-semibold">{t(guide.title)}</h2>
          <p className="text-sm text-muted-foreground">{all ? t("guide.allDone") : t(guide.intro)}</p>
        </div>
        {onHide ? (
          <Button variant="ghost" size="icon" aria-label={t("guide.hide")} onClick={onHide}>
            <X aria-hidden />
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
          <span className="block h-full rounded-full bg-success" style={{ width: `${(count / guide.steps.length) * 100}%` }} />
        </span>
        <span className="text-muted-foreground" data-testid="guide-progress">{t("guide.progress", { done: count, n: guide.steps.length })}</span>
      </div>
      <ol className="grid gap-2">
        {guide.steps.map((s, i) => {
          const ok = isDone(s.id, s.check);
          return (
            <li key={s.id} data-testid="guide-step" data-done={ok} className="flex items-start gap-3 rounded-md border bg-background p-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={ok}
                aria-label={t("guide.markDone", { step: t(s.title) })}
                disabled={!!s.check}
                onClick={() => onToggle(s.id)}
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                  ok ? "border-success bg-success text-success-foreground" : "bg-card",
                )}
              >
                {ok ? <Check aria-hidden className="size-4" /> : i + 1}
              </button>
              <Link href={s.href} className="group grid min-w-0 flex-1 gap-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <span className={cn("flex items-center gap-1 font-medium", ok && "text-muted-foreground line-through")}>
                  {t(s.title)}
                  <ChevronRight aria-hidden className="size-4 opacity-50 group-hover:opacity-100 rtl:rotate-180" />
                </span>
                <span className="text-sm text-muted-foreground">{t(s.body)}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

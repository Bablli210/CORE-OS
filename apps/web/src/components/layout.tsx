import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Page building blocks. Every screen reads top to bottom as: PageHeader (what this is, the one main action),
 * then Sections — each a titled block with its own count and action — so content never runs together.
 */

/** Screen title row: optional back link, title, one line saying what the screen is for, and its actions. */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
}) {
  return (
    <header className="mb-6 grid gap-3">
      {back ? (
        <Link
          href={back.href}
          className="-ms-1 inline-flex w-fit items-center gap-1 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft aria-hidden className="size-4 rtl:rotate-180" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid min-w-0 gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          {meta ? <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div> : null}
      </div>
    </header>
  );
}

/**
 * A titled block of a screen. The title carries a count when the section is a list, an optional one-line description,
 * and at most one action on the right. `plain` drops the card surface (for lists of cards or tables that bring their own).
 */
export function Section({
  title,
  count,
  description,
  action,
  children,
  plain,
  className,
  id,
  testId,
}: {
  title: React.ReactNode;
  count?: number;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  plain?: boolean;
  className?: string;
  id?: string;
  testId?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section id={id} aria-labelledby={headingId} data-testid={testId} className={cn("grid content-start gap-3", className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2">
            <h2 id={headingId} className="text-base font-semibold">
              {title}
            </h2>
            {count !== undefined ? (
              <span data-testid="section-count" className="inline-flex min-w-6 items-center justify-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
                {count}
              </span>
            ) : null}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      {plain ? children : <div className="rounded-lg border bg-card p-4 text-card-foreground">{children}</div>}
    </section>
  );
}

/** Vertical rhythm between the sections of a screen. */
export function Stack({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid gap-8", className)}>{children}</div>;
}

/** Labelled facts (label above value), in columns on wider screens. */
export function Facts({ items, className }: { items: { label: string; value: React.ReactNode; testId?: string }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4", className)}>
      {items.map((i) => (
        <div key={i.label} className="grid min-w-0 content-start gap-0.5" data-testid={i.testId}>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{i.label}</dt>
          <dd className="break-words text-sm">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Tabs that split a long screen into parts, kept in the URL (`?tab=`) so a tab can be linked and survives refresh.
 * `hrefFor` builds each tab's link (the page keeps its other params).
 */
export function PageTabs({
  tabs,
  active,
  hrefFor,
  label,
}: {
  tabs: { key: string; label: string; count?: number }[];
  active: string;
  hrefFor: (key: string) => string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b px-4 md:mx-0 md:px-0">
      <ul className="flex gap-1">
        {tabs.map((tab) => (
          <li key={tab.key}>
            <Link
              href={hrefFor(tab.key)}
              scroll={false}
              aria-current={tab.key === active ? "page" : undefined}
              data-testid={`page-tab-${tab.key}`}
              className={cn(
                "-mb-px flex min-h-tap items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                tab.key === active ? "border-foreground font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count ? <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums">{tab.count}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A list of rows inside one card, separated by lines (instead of a stack of loose cards). */
export function RowList({ children, className, testId }: { children: React.ReactNode; className?: string; testId?: string }) {
  return (
    <ul data-testid={testId} className={cn("divide-y overflow-hidden rounded-lg border bg-card text-card-foreground", className)}>
      {children}
    </ul>
  );
}

/**
 * Numbers that sum up a screen, each linking to the section (or screen) it counts. Shown at the top so the day can be
 * read at a glance before scrolling.
 */
export function SummaryStrip({ items, label }: { items: { label: string; value: React.ReactNode; href: string; tone?: "default" | "warning" | "destructive"; testId?: string }[]; label: string }) {
  return (
    <nav aria-label={label} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {items.map((i) => (
        <Link
          key={i.label}
          href={i.href}
          data-testid={i.testId}
          className={cn(
            "grid min-w-0 gap-0.5 rounded-lg border bg-card p-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            i.tone === "warning" && "border-warning",
            i.tone === "destructive" && "border-destructive",
          )}
        >
          <span className="text-2xl font-semibold tabular-nums leading-tight">{i.value}</span>
          <span className="text-xs leading-snug text-muted-foreground">{i.label}</span>
        </Link>
      ))}
    </nav>
  );
}

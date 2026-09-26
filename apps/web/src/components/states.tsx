import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { PageHeader } from "./layout";

/** docs/04 `EmptyState`: icon, one sentence, the next action. No dead ends (CLAUDE.md rule 8). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  body,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: { href: string; label: string } | React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <Icon className="size-8 text-muted-foreground" />
      <p className="font-medium">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action && typeof action === "object" && "href" in action ? (
        <Link href={action.href} className={cn(buttonVariants(), "w-full md:w-auto")}>
          {action.label}
        </Link>
      ) : (
        action
      )}
    </div>
  );
}

/** Errors say what to do next: the message plus a retry (or other) action. */
export function ErrorState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 px-4 py-8 text-center">
      <AlertTriangle className="size-8 text-destructive" />
      <p className="font-medium">{title}</p>
      {body ? <p className="max-w-sm text-sm text-muted-foreground">{body}</p> : null}
      {action}
    </div>
  );
}

export function LoadingList({ rows = 4, label }: { rows?: number; label: string }) {
  return (
    <div role="status" aria-label={label} className="grid gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  );
}

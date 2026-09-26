import { t } from "@gymos/i18n";

/** Centered single-column layout for the signed-out screens. */
export function AuthCard({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-4 py-8">
      <div className="grid gap-1">
        <p className="text-sm font-semibold text-muted-foreground">{t("app.name")}</p>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </main>
  );
}

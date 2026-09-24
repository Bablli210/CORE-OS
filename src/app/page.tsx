import { t } from "@/lib/i18n";

// Placeholder until M1 replaces it with role routing (docs/05-BUILD-PLAN.md).
export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-4">
      <h1 className="text-2xl font-semibold">{t("app.name")}</h1>
      <p className="text-muted-foreground">{t("scaffold.status")}</p>
    </main>
  );
}

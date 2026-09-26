import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/components/auth-card";
import { LoginTabs } from "@/features/auth/components/login-tabs";
import { getSession } from "@/features/auth/me";
import { safeNext } from "@gymos/api/auth/login-schema";
import { t } from "@gymos/i18n";

export const metadata: Metadata = { title: t("login.title") };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  if (await getSession()) redirect(safeNext(next));
  return (
    <AuthCard title={t("login.title")} description={t("login.description")}>
      {error === "link" ? (
        <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">
          {t("login.error.link")}
        </p>
      ) : null}
      <LoginTabs next={next} />
    </AuthCard>
  );
}

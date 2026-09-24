import { AuthCard } from "@/features/auth/components/auth-card";
import { t } from "@/lib/i18n";

/** Public onboarding wizard (signed token, no login) — built in M2. */
export default function OnboardPage() {
  return <AuthCard title={t("onboard.title")} description={t("onboard.notYet")} />;
}

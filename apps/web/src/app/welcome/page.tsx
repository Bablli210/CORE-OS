import { redirect } from "next/navigation";
import { AuthCard } from "@/features/auth/components/auth-card";
import { SetPasswordForm } from "@/features/auth/components/set-password-form";
import { getSession } from "@/features/auth/me";
import { t } from "@gymos/i18n";

/** Invited staff land here from the invite link to choose a password. */
export default async function WelcomePage() {
  const session = await getSession();
  if (!session) redirect("/login?error=link");
  return (
    <AuthCard title={t("welcome.title", { name: session.profile.fullName.split(" ")[0] })} description={t("welcome.description")}>
      <SetPasswordForm />
    </AuthCard>
  );
}

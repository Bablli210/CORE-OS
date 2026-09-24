import { AuthCard } from "@/features/auth/components/auth-card";
import { signOut } from "@/features/auth/actions";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

/** Signed in, but no active role (deactivated, or not set up yet). Says what to do next. */
export default function NoAccessPage() {
  return (
    <AuthCard title={t("noAccess.title")} description={t("noAccess.body")}>
      <form action={signOut}>
        <Button type="submit" size="block" variant="outline">
          {t("shell.signOut")}
        </Button>
      </form>
    </AuthCard>
  );
}

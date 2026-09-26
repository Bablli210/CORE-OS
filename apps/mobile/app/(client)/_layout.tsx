import { t } from "@gymos/i18n";
import { OutboxProvider } from "@gymos/api/training/use-outbox";
import { AppTabs } from "@/ui/tab-guard";

/** The client app (docs/05 M8 scope): Today, Workout (logs offline), Credits. One outbox for the whole app (shared with the web). */
export default function ClientLayout() {
  return (
    <OutboxProvider>
      <AppTabs kind="client" tabs={[{ name: "home", title: t("nav.today") }, { name: "workout", title: t("nav.workout") }, { name: "credits", title: t("nav.credits") }]} />
    </OutboxProvider>
  );
}

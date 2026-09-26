import { t } from "@gymos/i18n";
import { AppTabs } from "@/ui/tab-guard";

/** The coach app (docs/05 M8 scope): Today, Clients, Schedule. Everything else stays on the web. */
export default function CoachLayout() {
  return <AppTabs kind="coach" tabs={[{ name: "today", title: t("nav.today") }, { name: "clients", title: t("nav.clients") }, { name: "schedule", title: t("nav.schedule") }]} />;
}

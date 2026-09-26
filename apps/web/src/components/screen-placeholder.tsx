import { Construction } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/states";
import { t } from "@gymos/i18n";
import { SCREENS, type ScreenId } from "./screens";

/** A screen that exists in the navigation but is built in a later milestone. Names what's next and links onward. */
export function ScreenPlaceholder({ screen }: { screen: ScreenId }) {
  const info = SCREENS[screen];
  return (
    <>
      <PageHeader title={t(info.title)} description={t(info.job)} />
      <EmptyState
        icon={Construction}
        title={t("placeholder.comingIn", { milestone: info.milestone })}
        body={t("placeholder.body")}
        action={{ href: info.action.href, label: t(info.action.label) }}
      />
    </>
  );
}

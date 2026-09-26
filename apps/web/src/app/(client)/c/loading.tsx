import { LoadingList } from "@/components/states";
import { t } from "@gymos/i18n";

export default function Loading() {
  return <LoadingList rows={3} label={t("common.loading")} />;
}

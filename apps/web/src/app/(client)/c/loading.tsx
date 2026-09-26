import { LoadingList } from "@/components/states";
import { t } from "@/lib/i18n";

export default function Loading() {
  return <LoadingList rows={3} label={t("common.loading")} />;
}

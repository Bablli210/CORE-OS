import { View } from "react-native";
import { t } from "@gymos/i18n";
import { useSession } from "@/auth/session";
import { space } from "@/theme";
import { Button } from "@/ui/button";
import { Screen } from "@/ui/screen";
import { Text } from "@/ui/text";

/** Sales, front desk and top management use the web app (mobile v1 scope: clients and coaches). */
export default function Unsupported() {
  const { signOut } = useSession();
  return (
    <Screen title={t("mobile.webOnly.title")} footer={<Button block label={t("shell.signOut")} variant="outline" onPress={() => void signOut()} />}>
      <View style={{ gap: space[2] }}>
        <Text>{t("mobile.webOnly.body")}</Text>
      </View>
    </Screen>
  );
}

import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { t } from "@gymos/i18n";
import { radius, space, useColors } from "@/theme";
import { Button } from "./button";
import { Text } from "./text";

/** A bottom sheet (RN Modal; a dialog on the web build). */
export function Sheet({ title, children, onClose, testID }: { title: string; children: ReactNode; onClose: () => void; testID?: string }) {
  const c = useColors();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <Pressable accessibilityLabel={t("common.close")} onPress={onClose} style={{ flex: 1, backgroundColor: c.foreground, opacity: 0.3 }} />
      <View testID={testID} accessibilityViewIsModal aria-modal role="dialog" aria-label={title} style={{ backgroundColor: c.background, padding: space[4], gap: space[3], borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "80%" }}>
        <Text variant="heading" accessibilityRole="header">{title}</Text>
        {children}
        <Button label={t("common.close")} variant="ghost" onPress={onClose} />
      </View>
    </Modal>
  );
}

import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { space, useColors } from "@/theme";
import { Text } from "./text";

/**
 * A scrolling screen with a title and an optional pinned bottom action (the primary action, full width, in thumb reach).
 * Pull to refresh when `onRefresh` is given.
 */
export function Screen({ title, subtitle, children, footer, onRefresh, refreshing = false, testID }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode; onRefresh?: () => void; refreshing?: boolean; testID?: string }) {
  const c = useColors();
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.background }} testID={testID}>
      <ScrollView
        contentContainerStyle={{ padding: space[4], gap: space[3], paddingBottom: space[12] }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: space[1] }}>
          <Text variant="title" accessibilityRole="header">{title}</Text>
          {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
      {footer ? <View style={{ padding: space[4], borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background }}>{footer}</View> : null}
    </SafeAreaView>
  );
}

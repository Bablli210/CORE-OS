import { Redirect } from "expo-router";
import { Tabs } from "expo-router/js-tabs";
import type { ComponentProps } from "react";
import { useSession } from "@/auth/session";
import { useColors } from "@/theme";
import { Loading } from "./states";

type Tab = { name: string; title: string; hidden?: boolean };

/** The bottom tabs of one app (coach or client), shown only to the person that app is for. */
export function AppTabs({ kind, tabs }: { kind: "coach" | "client"; tabs: Tab[] }) {
  const { state } = useSession();
  const c = useColors();
  if (state.status === "loading") return <Loading />;
  if (state.status !== "ready") return <Redirect href="/login" />;
  if (state.scope.kind !== kind) return <Redirect href="/" />;
  const options: ComponentProps<typeof Tabs>["screenOptions"] = {
    headerShown: false,
    tabBarActiveTintColor: c.foreground,
    tabBarInactiveTintColor: c.mutedForeground,
    tabBarStyle: { backgroundColor: c.background, borderTopColor: c.border, minHeight: 56 },
    tabBarIcon: () => null,
    tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
  };
  return (
    <Tabs screenOptions={options}>
      {tabs.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarButtonTestID: `tab-${tab.name}`, href: tab.hidden ? null : undefined }} />
      ))}
    </Tabs>
  );
}

// Order matters: the device platform and the Supabase client are registered with @gymos/api before any screen runs.
import "@/lib/platform";
import "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider } from "@/auth/session";
import { nativePlatform } from "@/lib/platform";
import { Loading } from "@/ui/states";

export default function RootLayout() {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1 } } }));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // the coach's queued taps are read synchronously by the shared hook: load them before the first screen
    void nativePlatform.hydrate().finally(() => setReady(true));
  }, []);
  if (!ready) return <Loading />;
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <StatusBar style="auto" />
          <Stack screenOptions={{ headerShown: false }} />
        </SessionProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
// M8: register the browser's Supabase client and device platform with @gymos/api before any shared hook runs
import "@/lib/supabase/client";
import "@/lib/platform";

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session; created lazily so server renders never share state.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } } }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

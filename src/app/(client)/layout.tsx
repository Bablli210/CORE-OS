import { AppShell } from "@/components/shell/app-shell";
import { requireArea } from "@/features/auth/guard";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireArea("client");
  return <AppShell me={me}>{children}</AppShell>;
}

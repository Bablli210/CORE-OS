import { AppShell } from "@/components/shell/app-shell";
import { requireArea } from "@/features/auth/guard";
import { OutboxProvider } from "@/features/training/hooks/use-outbox";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireArea("client");
  return (
    <AppShell me={me}>
      <OutboxProvider>{children}</OutboxProvider>
    </AppShell>
  );
}

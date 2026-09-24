import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { getMe, getSession } from "@/features/auth/me";

/** Screens every role shares (notification center), shown in the shell of the role being acted as. */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  if (!me) redirect((await getSession()) ? "/no-access" : "/login");
  return <AppShell me={me}>{children}</AppShell>;
}

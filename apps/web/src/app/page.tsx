import { redirect } from "next/navigation";
import { getMe, getSession } from "@/features/auth/me";
import { homeFor } from "@gymos/api/auth/roles";

/** Role routing: client → /c, coaches → /coach, sales roles → /sales, top management → /admin (last used role first). */
export default async function Home() {
  const me = await getMe();
  if (me) redirect(homeFor(me.active));
  redirect((await getSession()) ? "/no-access" : "/login");
}

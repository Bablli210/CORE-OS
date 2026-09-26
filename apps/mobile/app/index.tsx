import { Redirect } from "expo-router";
import { useSession } from "@/auth/session";
import { Loading } from "@/ui/states";

/** Opens the right app for whoever is signed in on this phone. */
export default function Index() {
  const { state } = useSession();
  if (state.status === "loading") return <Loading />;
  if (state.status === "signed-out") return <Redirect href="/login" />;
  if (state.scope.kind === "coach") return <Redirect href="/today" />;
  if (state.scope.kind === "client") return <Redirect href="/home" />;
  return <Redirect href="/unsupported" />;
}

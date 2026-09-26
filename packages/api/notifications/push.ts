import { createClient } from "../supabase";

/** The phone's Expo push token for the signed-in person (0013): register on sign-in, unregister on sign-out. */
export async function registerPushToken(token: string, platform: "ios" | "android", device?: string | null): Promise<string> {
  const { data, error } = await createClient().rpc("fn_register_push_token", { p_token: token, p_platform: platform, p_device: device ?? undefined });
  if (error) throw error;
  return data as string;
}

export async function unregisterPushToken(token: string): Promise<boolean> {
  const { data, error } = await createClient().rpc("fn_unregister_push_token", { p_token: token });
  if (error) throw error;
  return data as boolean;
}

import type { Json } from "../database.types";
import { createClient } from "../supabase";
import type { SettingRow } from "./settings-model";

export const settingsKeys = { all: ["settings"] as const };

export async function fetchSettings(): Promise<SettingRow[]> {
  const { data, error } = await createClient().from("settings").select("key, value, description, updated_at").order("key");
  if (error) throw error;
  return data;
}

/** Through fn_update_setting: top management only, type-checked, audited, emits setting.updated. */
export async function updateSetting(key: string, value: Json): Promise<void> {
  const { error } = await createClient().rpc("fn_update_setting", { p_key: key, p_value: value });
  if (error) throw error;
}

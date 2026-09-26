"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { clearClientCaches } from "@gymos/api/training/offline/cache";
import { t } from "@gymos/i18n";

/** The member's cached data (shared, @gymos/api) and the service worker's cached pages (the web's own). */
async function forgetDevice() {
  await clearClientCaches();
  try {
    if ("caches" in window) for (const k of await caches.keys()) await caches.delete(k);
  } catch {
    /* nothing cached */
  }
}

/** Sign out; on a shared phone the cached pages and the member's cached data go too (queued workouts stay until sent). */
export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => void forgetDevice()}>
      <button
        type="submit"
        aria-label={t("shell.signOut")}
        className="inline-flex size-tap items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <LogOut aria-hidden className="size-5" />
      </button>
    </form>
  );
}

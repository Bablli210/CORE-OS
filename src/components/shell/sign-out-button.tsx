"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { clearClientCaches } from "@/features/training/offline/cache";
import { t } from "@/lib/i18n";

/** Sign out; on a shared phone the cached pages and the member's cached data go too (queued workouts stay until sent). */
export function SignOutButton() {
  return (
    <form action={signOut} onSubmit={() => void clearClientCaches()}>
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

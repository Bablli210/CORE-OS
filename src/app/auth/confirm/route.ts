import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/features/auth/schemas/login";
import { createClient } from "@/lib/supabase/server";

/** Email links (staff invite) land here with a token hash; verifying it creates the session server-side. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(safeNext(params.get("next")), request.url));
  }
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}

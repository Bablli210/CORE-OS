import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/features/auth/me";
import { CONTEXT_COOKIE, homeFor } from "@gymos/api/auth/roles";

/** Role switcher target: remembers the chosen membership and opens its home (or ?next= inside the app). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ membershipId: string }> }) {
  const { membershipId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const membership = session.memberships.find((m) => m.id === membershipId);
  if (!membership) return NextResponse.redirect(new URL("/", request.url));

  const next = request.nextUrl.searchParams.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : homeFor(membership);
  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(CONTEXT_COOKIE, membership.id, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 60 * 60 * 24 * 365 });
  return response;
}

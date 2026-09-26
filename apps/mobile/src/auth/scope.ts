import type { Membership, Session } from "@gymos/api/auth/session";

/** Mobile v1 scope (docs/05 M8): the client app, and the coach's Today / Clients / Schedule. */
export type Scope = { kind: "client"; membership: Membership } | { kind: "coach"; membership: Membership } | { kind: "unsupported" };

/**
 * Which app the phone shows. A client gets the client app. Staff who coach (a coach membership — head coaches have one
 * too) get the coach app. Anyone else (sales, front desk, top management) is sent to the web app.
 * A person who is both a client and a coach sees the coach app; they can use the web for the other.
 */
export function scopeFor(session: Session): Scope {
  const coach = session.memberships.find((m) => m.role === "coach");
  if (coach) return { kind: "coach", membership: coach };
  const client = session.memberships.find((m) => m.role === "client");
  if (client) return { kind: "client", membership: client };
  return { kind: "unsupported" };
}

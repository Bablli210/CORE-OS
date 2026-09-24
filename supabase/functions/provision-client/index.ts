// provision-client — docs/03 §9. Runs with the service role (bypasses RLS); listed there as an allowed exception.
// Called by the app's recordPayment server action right after fn_record_payment returns a client with no account.
//   1. Authorise: the caller's own token must be able to open the client (fn_sales_client: sales, coach, front desk, top).
//   2. Give the client a login: reuse the person if a profile already has this phone (one person, many memberships),
//      else create an auth user for phone OTP. Add the profile and the `client` membership, link clients.profile_id.
//   3. Backfill notifications queued on the client before the account existed; queue the welcome message; emit an event.
// No imports: plain fetch against the local stack's Auth and PostgREST (works offline in the edge runtime).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:3000";

const service = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "content-type": "application/json" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function rest(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...service, ...(init.headers ?? {}) } });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} → ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function callerId(authHeader: string): string | null {
  try {
    const payload = authHeader.replace(/^Bearer /, "").split(".")[1];
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub ?? null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  const actor = callerId(auth);
  let clientId: string | undefined;
  try {
    clientId = (await req.json()).client_id;
  } catch {
    /* handled below */
  }
  if (!actor || !clientId) return json({ ok: false, error: "client_id and a signed-in caller are required" }, 400);

  // 1. authorise with the caller's own token (RLS + the function's scope check)
  const check = await fetch(`${SUPABASE_URL}/rest/v1/rpc/fn_sales_client`, {
    method: "POST",
    headers: { apikey: ANON_KEY, Authorization: auth, "content-type": "application/json" },
    body: JSON.stringify({ p_client_id: clientId }),
  });
  if (!check.ok) return json({ ok: false, error: "not_allowed" }, 403);

  try {
    const [client] = await rest(`clients?id=eq.${clientId}&select=id,profile_id,full_name,phone,email,gender,home_branch_id`);
    if (!client) return json({ ok: false, error: "client_not_found" }, 404);
    if (client.profile_id) return json({ ok: true, profile_id: client.profile_id, created: false });

    // 2. the person: an existing profile with this phone, or a new phone-login user
    let profileId: string | null = (await rest(`profiles?phone=eq.${encodeURIComponent(client.phone)}&select=id`))[0]?.id ?? null;
    const created = !profileId;
    if (!profileId) {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: service,
        body: JSON.stringify({ phone: client.phone, phone_confirm: true, user_metadata: { full_name: client.full_name } }),
      });
      const body = await res.json();
      if (!res.ok) return json({ ok: false, error: body.error_code ?? "auth_create_failed", message: body.msg }, 409);
      profileId = body.id as string;
      await rest("profiles", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates" },
        body: JSON.stringify({ id: profileId, full_name: client.full_name, phone: client.phone, email: client.email, gender: client.gender }),
      });
    }
    await rest("memberships?on_conflict=profile_id,branch_id,role", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates" },
      body: JSON.stringify({ profile_id: profileId, branch_id: client.home_branch_id, role: "client" }),
    });
    await rest(`clients?id=eq.${clientId}`, { method: "PATCH", body: JSON.stringify({ profile_id: profileId }) });

    // 3. queued messages now have a recipient; welcome message; event
    await rest(`notifications?client_id=eq.${clientId}&recipient_profile_id=is.null`, { method: "PATCH", body: JSON.stringify({ recipient_profile_id: profileId }) });
    await rest("notifications", {
      method: "POST",
      body: JSON.stringify({
        recipient_profile_id: profileId,
        client_id: clientId,
        type: "client.created",
        title: "Welcome to the gym",
        body: `Your account is ready. Sign in with your phone number: ${APP_URL}/login`,
        channel: "whatsapp",
        data: { client_id: clientId },
      }),
    });
    await rest("events", {
      method: "POST",
      body: JSON.stringify({
        type: "client.provisioned",
        actor_profile_id: actor,
        branch_id: client.home_branch_id,
        subject_table: "clients",
        subject_id: clientId,
        payload: { profile_id: profileId, created_auth_user: created },
      }),
    });
    return json({ ok: true, profile_id: profileId, created });
  } catch (e) {
    console.error("provision-client", clientId, e);
    return json({ ok: false, error: "provision_failed" }, 500);
  }
});

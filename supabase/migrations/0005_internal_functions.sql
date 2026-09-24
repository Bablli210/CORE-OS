-- GymOS — 0005_internal_functions.sql
-- 0001 §19 grants EXECUTE on every public function to `authenticated`, which exposes the internal helpers
-- (docs/02 §7 calls them internal) over the REST API. They have no permission checks of their own because they are
-- meant to run only inside the checked fn_* entry points. Exposed, any signed-in user could, for example, call
-- fn_issue_credits to give themselves sessions, fn_notify to message anyone, or fn_convert_lead on any lead.
--
-- Revoking EXECUTE does not affect the entry points: they are SECURITY DEFINER and call these as the owner.
-- Jobs (pg_cron, psql as the owner) are unaffected too.

revoke execute on function
  fn_emit_event(text, text, uuid, uuid, jsonb),
  fn_notify(uuid, text, text, text, jsonb, notification_channel),
  fn_notify_client(uuid, text, text, text, jsonb, notification_channel),
  fn_notify_role(app_role, uuid, text, text, text, jsonb),
  fn_round_robin_next(uuid),
  fn_convert_lead(uuid, uuid),
  fn_issue_credits(uuid, uuid, int, bigint, int, uuid),
  fn_set_primary_coach(uuid, uuid, text),
  fn_settle_unpaid_sessions(uuid, uuid),
  fn_consume_credit(uuid, uuid, text),
  fn_restore_credit(uuid, text),
  fn_apply_attendance(uuid, session_status, boolean, text, boolean),
  fn_flag_for_sales_internal(uuid, text, text, uuid),
  fn_apply_expiry_extension(uuid, timestamptz, text),
  fn_expire_credits(),
  fn_compute_risk_scores(),
  fn_mark_lapsed()
from public, anon, authenticated;

-- fn_end_freeze stays callable (docs/03 §4: ended by the nightly job "or manual"), now with a permission check:
-- the job (no signed-in user), top management, or the sales manager of the client's branch.
create or replace function fn_end_freeze(p_freeze_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare f freezes; v_branch uuid;
begin
  select * into f from freezes where id = p_freeze_id and status = 'active' for update;
  if not found then return; end if;
  select home_branch_id into v_branch from clients where id = f.client_id;
  if auth.uid() is not null and not (is_top_management() or has_role('sales_manager', v_branch)) then
    raise exception 'only the sales manager can end a freeze early' using errcode = 'insufficient_privilege';
  end if;
  update credit_lots set expires_at = expires_at + make_interval(days => f.days) where client_id = f.client_id and status = 'active';
  update entitlements set ends_at = ends_at + make_interval(days => f.days), status = 'active' where client_id = f.client_id and status = 'frozen';
  update freezes set status = 'ended' where id = p_freeze_id;
  update clients set status = 'active' where id = f.client_id and status = 'frozen';
  perform fn_notify_client(f.client_id, 'freeze.ended', 'Welcome back', 'Your freeze has ended; your sessions and membership were extended by ' || f.days || ' days', jsonb_build_object('freeze_id', p_freeze_id), 'whatsapp');
  perform fn_emit_event('freeze.ended', 'freezes', p_freeze_id, v_branch, jsonb_build_object('client_id', f.client_id, 'days', f.days));
end $$;

"use server";

import type { AuthError } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { MessageKey } from "@gymos/i18n";
import { createClient } from "@/lib/supabase/server";
import {
  otpRequestSchema,
  otpVerifySchema,
  safeNext,
  setPasswordSchema,
  staffLoginSchema,
  type OtpRequest,
  type OtpVerify,
  type SetPassword,
  type StaffLogin,
} from "@gymos/api/auth/login-schema";

export type ActionResult = { error?: MessageKey };

function authErrorKey(error: AuthError): MessageKey {
  switch (error.code) {
    case "invalid_credentials":
      return "login.error.invalid";
    case "otp_disabled":
    case "user_not_found":
    case "phone_not_confirmed":
      return "login.error.unknownPhone";
    case "otp_expired":
      return "login.error.codeInvalid";
    case "over_request_rate_limit":
    case "over_sms_send_rate_limit":
      return "login.error.tooMany";
    case "weak_password":
      return "welcome.error.short";
    default:
      return "error.generic";
  }
}

/** Staff: email + password. On success the root route sends them to their role's home. */
export async function signInStaff(input: StaffLogin, next?: string): Promise<ActionResult> {
  const parsed = staffLoginSchema.safeParse(input);
  if (!parsed.success) return { error: "login.error.invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorKey(error) };
  redirect(safeNext(next));
}

/** Clients: phone → one-time code. Only existing clients (accounts are created when a pack is sold). */
export async function requestClientOtp(input: OtpRequest): Promise<ActionResult> {
  const parsed = otpRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "phone.error.invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone, options: { shouldCreateUser: false } });
  return error ? { error: authErrorKey(error) } : {};
}

export async function verifyClientOtp(input: OtpVerify, next?: string): Promise<ActionResult> {
  const parsed = otpVerifySchema.safeParse(input);
  if (!parsed.success) return { error: "login.error.codeFormat" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone: parsed.data.phone, token: parsed.data.token, type: "sms" });
  if (error) return { error: authErrorKey(error) };
  redirect(safeNext(next));
}

/** Invited staff choose their password after following the invite link (/auth/confirm → /welcome). */
export async function setPassword(input: SetPassword): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse(input);
  if (!parsed.success) return { error: "welcome.error.short" };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authErrorKey(error) };
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

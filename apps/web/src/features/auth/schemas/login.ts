import { z } from "zod";
import { isE164 } from "@/lib/phone";

export const staffLoginSchema = z.object({
  email: z.email("login.error.email"),
  password: z.string().min(1, "login.error.passwordRequired"),
});
export type StaffLogin = z.infer<typeof staffLoginSchema>;

export const phoneSchema = z.string().refine(isE164, "phone.error.invalid");

export const otpRequestSchema = z.object({ phone: phoneSchema });
export type OtpRequest = z.infer<typeof otpRequestSchema>;

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  token: z.string().regex(/^\d{6}$/, "login.error.codeFormat"),
});
export type OtpVerify = z.infer<typeof otpVerifySchema>;

export const setPasswordSchema = z
  .object({
    password: z.string().min(8, "welcome.error.short"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "welcome.error.mismatch", path: ["confirm"] });
export type SetPassword = z.infer<typeof setPasswordSchema>;

/** Only same-app paths are followed after login. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login") ? next : "/";
}

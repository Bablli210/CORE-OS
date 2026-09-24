import { z } from "zod";
import type { AppRole } from "@/features/auth/roles";
import { isE164 } from "@/lib/phone";

export const STAFF_ROLES = ["top_management", "sales_manager", "sales_rep", "front_desk", "head_coach", "coach", "nutritionist"] as const satisfies readonly AppRole[];
export type StaffRole = (typeof STAFF_ROLES)[number];

export const COACHING_ROLES: StaffRole[] = ["head_coach", "coach", "nutritionist"];
export const DISCOUNT_ROLES: StaffRole[] = ["sales_rep", "sales_manager", "top_management"];

const membershipFields = {
  role: z.enum(STAFF_ROLES),
  branchId: z.string().nullable(),
  capacity: z.number().int().min(0).max(500).nullable(),
  specialties: z.array(z.string().trim().min(1)).max(20),
  discountAllowancePct: z.number().min(0, "people.error.discountRange").max(100, "people.error.discountRange"),
  isActive: z.boolean(),
};

function branchRule(v: { role: StaffRole; branchId: string | null }) {
  return v.role === "top_management" ? v.branchId === null : !!v.branchId;
}

export const membershipSchema = z.object(membershipFields).refine(branchRule, { message: "people.error.branch", path: ["branchId"] });
export type MembershipInput = z.infer<typeof membershipSchema>;

export const inviteSchema = z
  .object({
    fullName: z.string().trim().min(2, "people.error.name"),
    email: z.email("login.error.email"),
    phone: z.string().refine((v) => v === "" || isE164(v), "phone.error.invalid"),
    role: z.enum(STAFF_ROLES),
    branchId: z.string().nullable(),
  })
  .refine(branchRule, { message: "people.error.branch", path: ["branchId"] });
export type InviteInput = z.infer<typeof inviteSchema>;

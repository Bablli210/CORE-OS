/**
 * Onboarding wizard, schema v1 (docs/03 §2). Seven question screens + the done screen (docs/01 §4.2: ≤ 8).
 * Each step saves under its key through fn_submit_onboarding; a refresh resumes at the first unsaved step.
 */
export type Answer = string | number | boolean | string[] | Record<string, boolean> | null;
export type Answers = Record<string, Answer>;
export type Responses = Record<string, Answers>;

export type FieldDef =
  | { name: string; type: "text" | "date"; required?: boolean }
  | { name: string; type: "single"; options: (string | number)[]; required?: boolean }
  | { name: string; type: "multi"; options: string[]; required?: boolean }
  | { name: string; type: "yesno"; required?: boolean }
  | { name: string; type: "parq"; questions: string[]; required?: boolean }
  | { name: string; type: "check"; required?: boolean };

export type StepDef = { key: string; fields: FieldDef[]; when?: (r: Responses) => boolean };

export const PARQ = ["q1", "q2", "q3", "q4", "q5", "q6", "q7"];

export const STEPS: StepDef[] = [
  {
    key: "identity",
    fields: [
      { name: "full_name", type: "text", required: true },
      { name: "preferred_language", type: "single", options: ["en", "ar"], required: true },
      { name: "date_of_birth", type: "date" },
      { name: "gender", type: "single", options: ["male", "female"], required: true },
    ],
  },
  {
    key: "goal",
    fields: [
      { name: "primary", type: "single", options: ["fat_loss", "muscle", "strength", "general", "rehab", "sport", "other"], required: true },
      { name: "timeline_weeks", type: "single", options: [4, 8, 12, 24] },
      { name: "notes", type: "text" },
    ],
  },
  {
    key: "interest",
    fields: [
      { name: "membership", type: "single", options: ["monthly", "quarterly", "annual", "none"], required: true },
      { name: "pt", type: "single", options: ["yes", "no", "maybe"], required: true },
      { name: "nutrition", type: "single", options: ["yes", "no", "maybe"], required: true },
    ],
  },
  {
    key: "pt_prefs",
    when: (r) => r.interest?.pt !== "no",
    fields: [
      { name: "time", type: "single", options: ["morning", "afternoon", "evening"], required: true },
      { name: "days", type: "multi", options: ["sat", "sun", "mon", "tue", "wed", "thu", "fri"], required: true },
      { name: "trainer_gender", type: "single", options: ["male", "female", "any"], required: true },
      { name: "sessions_per_week", type: "single", options: [1, 2, 3, 4, 5], required: true },
    ],
  },
  {
    key: "health",
    fields: [
      { name: "conditions", type: "multi", options: ["knee", "back", "shoulder", "heart", "blood_pressure", "diabetes", "asthma", "pregnancy"] },
      { name: "injuries", type: "text" },
      { name: "medical_clearance", type: "yesno", required: true },
      { name: "parq", type: "parq", questions: PARQ, required: true },
      { name: "acknowledged", type: "check", required: true },
    ],
  },
  {
    key: "experience",
    fields: [
      { name: "level", type: "single", options: ["beginner", "intermediate", "advanced"], required: true },
      { name: "current_activity", type: "text" },
    ],
  },
  {
    key: "social",
    fields: [
      { name: "heard_from", type: "single", options: ["instagram", "walk_in", "referral", "website", "event", "phone", "other"], required: true },
      { name: "instagram_handle", type: "text" },
      { name: "consent_content", type: "yesno", required: true },
      { name: "consent_marketing", type: "yesno", required: true },
    ],
  },
];

/** Steps that apply given the answers so far (PT preferences only when PT is yes/maybe). */
export function activeSteps(r: Responses): StepDef[] {
  return STEPS.filter((s) => !s.when || s.when(r));
}

/** Index (into activeSteps) of the first step not yet saved; the last step when all are saved but not completed. */
export function resumeIndex(r: Responses): number {
  const steps = activeSteps(r);
  const i = steps.findIndex((s) => !r[s.key]);
  return i === -1 ? steps.length - 1 : i;
}

/** Names of required fields that are missing or invalid. */
export function missingFields(step: StepDef, a: Answers): string[] {
  return step.fields
    .filter((f) => f.required)
    .filter((f) => {
      const v = a[f.name];
      if (f.type === "multi") return !Array.isArray(v) || v.length === 0;
      if (f.type === "yesno") return typeof v !== "boolean";
      if (f.type === "check") return v !== true;
      if (f.type === "parq") return !v || typeof v !== "object" || f.questions.some((q) => typeof (v as Record<string, boolean>)[q] !== "boolean");
      return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
    })
    .map((f) => f.name);
}

/** Initial answers for a step: what was saved, else sensible prefills from the lead record. */
export function initialAnswers(step: StepDef, r: Responses, prefill: { full_name?: string; heard_from?: string | null; instagram_handle?: string | null }): Answers {
  const saved = r[step.key];
  if (saved) return saved;
  if (step.key === "identity") return { full_name: prefill.full_name ?? "", preferred_language: "en" };
  if (step.key === "social") return { heard_from: prefill.heard_from ?? null, instagram_handle: prefill.instagram_handle ?? "" };
  return {};
}

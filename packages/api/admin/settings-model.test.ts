import { describe, expect, it } from "vitest";
import { groupSettings, humanizeKey, parseTiers, serializeTiers, settingKind, validateTiers, type SettingRow } from "./settings-model";

const row = (key: string, value: SettingRow["value"]): SettingRow => ({ key, value, description: null, updated_at: "" });

describe("settings model", () => {
  it("picks an editor from the value's type", () => {
    expect(settingKind("leads.round_robin_enabled", true)).toBe("boolean");
    expect(settingKind("attendance.edit_window_hours", 24)).toBe("number");
    expect(settingKind("attribution.renewal_owner", "closer")).toBe("text");
    expect(settingKind("commission.pt_tiers", [])).toBe("tiers");
    expect(settingKind("x.y", { a: 1 })).toBe("json");
  });

  it("groups keys in the docs/04 order, with leads under Sales", () => {
    const groups = groupSettings([row("risk.x", 1), row("leads.review_required", false), row("sales.stale_lead_days", 14), row("auth.client_otp_channel", "whatsapp")]);
    expect(groups.map((g) => g.id)).toEqual(["sales", "risk", "other"]);
    expect(groups[0].rows.map((r) => r.key)).toEqual(["leads.review_required", "sales.stale_lead_days"]);
  });

  it("round-trips commission tiers with an open-ended last tier", () => {
    const stored = [{ up_to: 160, pct: 30 }, { up_to: 200, pct: 40 }, { up_to: null, pct: 50 }];
    const tiers = parseTiers(stored);
    expect(tiers).toEqual([{ upTo: 160, pct: 30 }, { upTo: 200, pct: 40 }, { upTo: null, pct: 50 }]);
    expect(serializeTiers(tiers)).toEqual(stored);
    expect(validateTiers(tiers)).toBeNull();
  });

  it("rejects tiers the database would reject", () => {
    expect(validateTiers([{ upTo: 200, pct: 30 }, { upTo: 100, pct: 40 }, { upTo: null, pct: 50 }])).toBe("settings.tiers.errorOrder");
    expect(validateTiers([{ upTo: null, pct: 120 }])).toBe("settings.tiers.errorPct");
    expect(validateTiers([])).toBe("settings.tiers.errorEmpty");
  });

  it("humanizes keys", () => {
    expect(humanizeKey("attendance.edit_window_hours")).toBe("Edit window hours");
  });
});

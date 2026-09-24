import { describe, expect, it } from "vitest";
import { countryOptions, fromE164, isE164, toE164 } from "./phone";

describe("phone normalization (E.164 only)", () => {
  it("reads a local Egyptian number with the default country", () => {
    expect(toE164("01011112222")).toBe("+201011112222");
    expect(toE164("010 1111 2222")).toBe("+201011112222");
  });

  it("reads a Saudi number when Saudi Arabia is picked", () => {
    expect(toE164("0501234567", "SA")).toBe("+966501234567");
  });

  it("keeps an international number's own country", () => {
    expect(toE164("+966501234567")).toBe("+966501234567");
    expect(toE164("00201011112222")).toBe("+201011112222");
  });

  it("rejects what is not a phone number", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("12345")).toBeNull();
    expect(isE164("01011112222")).toBe(false);
    expect(isE164("+201011112222")).toBe(true);
  });

  it("splits a stored number for editing and lists Egypt first", () => {
    expect(fromE164("+966501234567")?.country).toBe("SA");
    expect(countryOptions()[0]).toMatchObject({ code: "EG", dialCode: "+20" });
  });
});

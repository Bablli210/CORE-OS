import { describe, expect, it } from "vitest";
import { notificationHref } from "./notifications";

describe("notification deep links", () => {
  it("opens the subject in the user's area", () => {
    expect(notificationHref({ lead_id: "L1" }, "sales")).toBe("/sales/leads/L1");
    expect(notificationHref({ client_id: "C1" }, "coach")).toBe("/coach/clients/C1");
    expect(notificationHref({ approval_id: "A1" }, "coach")).toBe("/coach/team");
    expect(notificationHref({ approval_id: "A1" }, "sales")).toBe("/sales/queue");
    expect(notificationHref({}, "admin")).toBeNull();
    expect(notificationHref(null, "admin")).toBeNull();
  });
});

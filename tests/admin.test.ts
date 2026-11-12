import { describe, expect, it } from "vitest";
import { isValidReportStatus, isValidRole, trialExtensionDate } from "../src/lib/admin/service";

describe("M8 admin rules", () => {
  it("extends a trial by an exact number of days", () => {
    const from = new Date("2026-11-12T00:00:00.000Z");
    expect(trialExtensionDate(from, 7).toISOString()).toBe("2026-11-19T00:00:00.000Z");
    expect(trialExtensionDate(from, 1).toISOString()).toBe("2026-11-13T00:00:00.000Z");
    expect(trialExtensionDate(from, 90).toISOString()).toBe("2027-02-10T00:00:00.000Z");
  });

  it("accepts only the three report statuses", () => {
    expect(isValidReportStatus("open")).toBe(true);
    expect(isValidReportStatus("reviewed")).toBe(true);
    expect(isValidReportStatus("actioned")).toBe(true);
    expect(isValidReportStatus("closed")).toBe(false);
    expect(isValidReportStatus("")).toBe(false);
  });

  it("accepts only the three account roles", () => {
    expect(isValidRole("candidate")).toBe(true);
    expect(isValidRole("church")).toBe(true);
    expect(isValidRole("admin")).toBe(true);
    expect(isValidRole("superadmin")).toBe(false);
    expect(isValidRole("")).toBe(false);
  });
});

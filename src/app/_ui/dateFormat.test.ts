import { describe, expect, it } from "vitest";

import { formatShortDate, formatShortDateTime } from "@/app/_ui/dateFormat";

const sample = new Date("2026-08-28T14:35:00.000Z");

describe("localized date formatting", () => {
  it("uses Irish English month names for English", () => {
    expect(formatShortDate(sample, "en")).toContain("Aug");
  });

  it("uses Ukrainian month names for Ukrainian", () => {
    const formatted = formatShortDate(sample, "uk");

    expect(formatted).toMatch(/серп/i);
    expect(formatted).not.toContain("Aug");
  });

  it("includes the localized time for appointments", () => {
    expect(formatShortDateTime(sample, "uk")).toMatch(/14:35|16:35|15:35/);
  });
});

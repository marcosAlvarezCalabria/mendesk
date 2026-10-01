import { describe, expect, it } from "vitest";

import { resolveStatsRange } from "@/app/stats/statsRange";

describe("resolveStatsRange", () => {
  const today = new Date("2026-08-23T14:30:00.000Z");

  it("defaults to the complete current Dublin day", () => {
    expect(resolveStatsRange("future", undefined, undefined, today)).toEqual({
      from: new Date("2026-08-22T23:00:00.000Z"),
      to: new Date("2026-08-23T23:00:00.000Z"),
    });
  });

  it("resolves the Dublin week from Monday to the following Monday", () => {
    expect(resolveStatsRange("this_week", undefined, undefined, today)).toEqual({
      from: new Date("2026-08-16T23:00:00.000Z"),
      to: new Date("2026-08-23T23:00:00.000Z"),
    });
  });

  it("resolves the complete Dublin month", () => {
    expect(resolveStatsRange("this_month", undefined, undefined, today)).toEqual({
      from: new Date("2026-07-31T23:00:00.000Z"),
      to: new Date("2026-08-31T23:00:00.000Z"),
    });
  });

  it("treats More dates as inclusive local dates with an exclusive next-day boundary", () => {
    expect(resolveStatsRange("more", "2026-10-24", "2026-10-25", today)).toEqual({
      from: new Date("2026-10-23T23:00:00.000Z"),
      to: new Date("2026-10-26T00:00:00.000Z"),
    });
  });

  it("falls back to Today for invalid More dates", () => {
    expect(resolveStatsRange("more", "bad", "2026-08-12", today)).toEqual({
      from: new Date("2026-08-22T23:00:00.000Z"),
      to: new Date("2026-08-23T23:00:00.000Z"),
    });
  });
});

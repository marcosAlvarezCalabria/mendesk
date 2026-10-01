import { describe, expect, it } from "vitest";
import { dublinDayRange, dublinOverdueDays, ordersAttention } from "./ordersOverviewRules";

describe("Dublin operational calendar", () => {
  it.each([
    ["2026-03-29T12:00:00Z", "2026-03-29T00:00:00.000Z", "2026-03-29T23:00:00.000Z"],
    ["2026-10-25T12:00:00Z", "2026-10-24T23:00:00.000Z", "2026-10-26T00:00:00.000Z"],
    ["2026-07-01T00:00:00Z", "2026-06-30T23:00:00.000Z", "2026-07-01T23:00:00.000Z"],
    ["2027-01-01T12:00:00Z", "2027-01-01T00:00:00.000Z", "2027-01-02T00:00:00.000Z"],
  ])("uses civil midnight for %s", (now, start, end) => {
    const range = dublinDayRange(new Date(now));
    expect(range.start.toISOString()).toBe(start);
    expect(range.end.toISOString()).toBe(end);
  });
  const now = new Date("2026-07-01T12:00:00Z");
  it.each(["received", "ready", "collected", "cancelled"] as const)("keeps %s attention disjoint", (status) => {
    const dates = ["2026-06-30T22:59:59.999Z", "2026-06-30T23:00:00Z", "2026-07-01T22:59:59.999Z", "2026-07-01T23:00:00Z", "2026-07-02T22:59:59.999Z", "2026-07-02T23:00:00Z"];
    expect(dates.map(date => ordersAttention(status, new Date(date), now))).toEqual(
      status === "received" ? ["overdue", "due_today", "due_today", "due_tomorrow", "due_tomorrow", null] : status === "ready" ? Array(6).fill("ready_for_pickup") : Array(6).fill(null),
    );
  });
  it("counts civil days across DST, never elapsed 24-hour periods", () => {
    expect(dublinOverdueDays(new Date("2026-03-29T00:00:00Z"), new Date("2026-03-29T23:00:00Z"))).toBe(1);
    expect(dublinOverdueDays(new Date("2026-10-24T23:00:00Z"), new Date("2026-10-26T00:00:00Z"))).toBe(1);
    expect(dublinOverdueDays(new Date("2027-01-01"), new Date("2026-12-31"))).toBe(0);
  });
  it("rejects invalid dates", () => {
    expect(() => dublinDayRange(new Date(NaN))).toThrow(RangeError);
    expect(() => ordersAttention("ready", new Date(NaN), now)).toThrow(RangeError);
  });
});

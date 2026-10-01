import { describe, expect, it } from "vitest";
import { formatOrdersDate, formatOrdersToday, formatOrdersMoney, formatOrdersGarmentCount, formatOrdersOverdueDays } from "./ordersOverviewFormat";
describe("overview locale formatting", () => {
  it("formats the Dublin civil date rather than UTC or device time", () => {
    expect(formatOrdersDate("2026-06-30T23:30:00Z", "en")).toContain("01 Jul 2026");
    expect(formatOrdersToday("2026-06-30T23:30:00Z", "en")).toContain("Wednesday");
  });
  it("uses EUR and real cents", () => {
    expect(formatOrdersMoney(1234, "en")).toBe("€12.34");
    expect(formatOrdersMoney(1234, "uk")).toContain("12,34");
  });
  it.each([[1, "1 виріб"], [2, "2 вироби"], [5, "5 виробів"], [21, "21 виріб"]])("uses Ukrainian plural for %s", (count, text) => {
    expect(formatOrdersGarmentCount(count as number, "uk")).toBe(text);
  });
  it("formats overdue plurals and rejects invalid values", () => {
    expect(formatOrdersOverdueDays(1, "en")).toBe("1 day overdue");
    expect(formatOrdersOverdueDays(2, "uk")).toContain("2 дні");
    expect(() => formatOrdersDate("bad", "en")).toThrow(RangeError);
    expect(() => formatOrdersMoney(-1, "en")).toThrow(RangeError);
    expect(() => formatOrdersGarmentCount(1.2, "en")).toThrow(RangeError);
  });
});

import { describe, expect, it } from "vitest";

import { InvalidOrderNumberError } from "@/domain/errors/InvalidOrderNumberError";
import { OrderNumber } from "@/domain/values/OrderNumber";

describe("OrderNumber", () => {
  it("composes the base YYMMDD-sequence format", () => {
    expect(OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142).value).toBe("260819-0142");
  });

  it("pads month, day, and sequence", () => {
    expect(OrderNumber.compose(new Date(Date.UTC(2026, 0, 5)), 1).value).toBe("260105-0001");
  });

  it("does not truncate sequences longer than four digits", () => {
    expect(OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 12345).value).toBe("260819-12345");
  });

  it("rejects zero as the lower sequence boundary", () => {
    expect(() => OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 0)).toThrow(InvalidOrderNumberError);
  });

  it("rejects negative and non-integer sequences", () => {
    expect(() => OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), -1)).toThrow(InvalidOrderNumberError);
    expect(() => OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 1.5)).toThrow(InvalidOrderNumberError);
  });

  it("rejects invalid dates", () => {
    expect(() => OrderNumber.compose(new Date("not-a-date"), 1)).toThrow(InvalidOrderNumberError);
  });
  it("creates an order number from a valid string", () => {
    expect(OrderNumber.fromString("260819-0142").value).toBe("260819-0142");
  });

  it("keeps long sequences when creating from string", () => {
    expect(OrderNumber.fromString("260819-12345").value).toBe("260819-12345");
  });

  it("round-trips composed order numbers from string", () => {
    const composed = OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142);

    expect(OrderNumber.fromString(composed.value).value).toBe(composed.value);
  });

  it("rejects invalid order number strings", () => {
    expect(() => OrderNumber.fromString("abc")).toThrow(InvalidOrderNumberError);
    expect(() => OrderNumber.fromString("2608-0142")).toThrow(InvalidOrderNumberError);
    expect(() => OrderNumber.fromString("260819-")).toThrow(InvalidOrderNumberError);
  });
});

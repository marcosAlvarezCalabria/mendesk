import { describe, expect, it } from "vitest";

import { InvalidStatusTransitionError } from "@/domain/errors/InvalidStatusTransitionError";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("OrderStatus", () => {
  it("allows received to transition to ready", () => {
    expect(OrderStatus.RECEIVED.canTransitionTo(OrderStatus.READY)).toBe(true);
  });

  it("does not allow received to skip to collected", () => {
    expect(OrderStatus.RECEIVED.canTransitionTo(OrderStatus.COLLECTED)).toBe(false);
  });

  it("allows ready to transition to collected", () => {
    expect(OrderStatus.READY.canTransitionTo(OrderStatus.COLLECTED)).toBe(true);
  });

  it("allows non-terminal statuses to transition to cancelled", () => {
    expect(OrderStatus.RECEIVED.canTransitionTo(OrderStatus.CANCELLED)).toBe(true);
    expect(OrderStatus.READY.canTransitionTo(OrderStatus.CANCELLED)).toBe(true);
  });

  it("treats collected as terminal", () => {
    expect(OrderStatus.COLLECTED.canTransitionTo(OrderStatus.CANCELLED)).toBe(false);
  });

  it("does not allow backwards or self transitions", () => {
    expect(OrderStatus.READY.canTransitionTo(OrderStatus.RECEIVED)).toBe(false);
    expect(OrderStatus.RECEIVED.canTransitionTo(OrderStatus.RECEIVED)).toBe(false);
  });

  it("returns the next status for a valid transition", () => {
    expect(OrderStatus.READY.transitionTo(OrderStatus.COLLECTED).equals(OrderStatus.COLLECTED)).toBe(true);
  });

  it("throws for invalid transitions", () => {
    expect(() => OrderStatus.COLLECTED.transitionTo(OrderStatus.CANCELLED)).toThrow(InvalidStatusTransitionError);
  });
});

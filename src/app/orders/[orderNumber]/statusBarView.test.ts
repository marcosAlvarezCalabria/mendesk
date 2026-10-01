import { describe, expect, it } from "vitest";

import { statusActionControlClassName, statusActionLayoutClassName, shouldRenderStatusBar, statusErrorMessage, statusSuccessMessage } from "@/app/orders/[orderNumber]/statusBarView";

const successLabels = {
  ready: "Order marked Ready.",
  collected: "Order marked Collected.",
  cancelled: "Order cancelled.",
};

describe("status action layout", () => {
  it("keeps two actions parallel on mobile", () => {
    expect(statusActionLayoutClassName()).toContain("grid-cols-2");
  });

  it("uses compact controls without shrinking below 44px", () => {
    expect(statusActionControlClassName()).toContain("min-h-11");
    expect(statusActionControlClassName()).not.toContain("min-h-14");
    expect(statusActionControlClassName()).toContain("active:scale-[0.98]");
    expect(statusActionControlClassName()).toContain("duration-75");
    expect(statusActionControlClassName()).toContain("motion-reduce:transform-none");
  });
});

describe("shouldRenderStatusBar", () => {
  it("keeps the bar visible for success feedback when no actions remain", () => {
    expect(shouldRenderStatusBar([], undefined, { status: "success", mutationResult: "confirmed-saved", error: null, target: "collected" })).toBe(true);
  });

  it("hides an empty idle bar", () => {
    expect(shouldRenderStatusBar([], undefined, { status: "idle", error: null })).toBe(false);
  });
});

describe("statusSuccessMessage", () => {
  it.each([
    ["ready", "Order marked Ready."],
    ["collected", "Order marked Collected."],
    ["cancelled", "Order cancelled."],
  ] as const)("returns the %s confirmation", (target, expected) => {
    expect(statusSuccessMessage({ status: "success", mutationResult: "confirmed-saved", error: null, target }, successLabels)).toBe(expected);
  });

  it("returns no confirmation for idle or error states", () => {
    expect(statusSuccessMessage({ status: "idle", error: null }, successLabels)).toBeNull();
    expect(statusSuccessMessage({ status: "error", mutationResult: "outcome-unknown", error: "unexpected" }, successLabels)).toBeNull();
  });
});

describe("statusErrorMessage", () => {
  const errorLabels = {
    "invalid-transition": "Refresh the order and try again.",
    conflict: "The order changed elsewhere.",
    unexpected: "We couldn't update the order. Check your connection and try again.",
  };

  it.each([
    ["invalid-transition", "Refresh the order and try again."],
    ["conflict", "The order changed elsewhere."],
    ["unexpected", "We couldn't update the order. Check your connection and try again."],
  ] as const)("returns recoverable copy for %s", (error, expected) => {
    expect(statusErrorMessage({ status: "error", mutationResult: "confirmed-not-saved", error }, errorLabels)).toBe(expected);
  });

  it("returns no error copy outside an error state", () => {
    expect(statusErrorMessage({ status: "idle", error: null }, errorLabels)).toBeNull();
  });
});

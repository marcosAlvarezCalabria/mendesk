import { describe, expect, it } from "vitest";

import { isPaymentMethod } from "@/domain/values/PaymentMethod";

describe("isPaymentMethod", () => {
  it("accepts known payment methods", () => {
    expect(isPaymentMethod("cash")).toBe(true);
  });

  it("rejects unknown payment methods", () => {
    expect(isPaymentMethod("paypal")).toBe(false);
  });
});

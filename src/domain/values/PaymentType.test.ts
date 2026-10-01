import { describe, expect, it } from "vitest";

import { isPaymentType } from "@/domain/values/PaymentType";

describe("isPaymentType", () => {
  it("accepts known payment types", () => {
    expect(isPaymentType("deposit")).toBe(true);
  });

  it("rejects unknown payment types", () => {
    expect(isPaymentType("transfer")).toBe(false);
  });
});

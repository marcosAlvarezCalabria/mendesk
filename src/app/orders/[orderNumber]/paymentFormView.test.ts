import { describe, expect, it } from "vitest";

import { isPaymentAmountValid, paymentAmountIssue, paymentFormDefaults, shouldShowPaymentForm } from "@/app/orders/[orderNumber]/paymentFormView";
import { Money } from "@/domain/values/Money";

describe("payment form view", () => {
  it("starts a received deposit with an empty amount", () => {
    expect(paymentFormDefaults("received", Money.fromEuros(45.5))).toEqual({
      amount: "",
      type: "deposit",
    });
  });

  it("suggests the outstanding final payment for a ready order", () => {
    expect(paymentFormDefaults("ready", Money.fromEuros(25))).toEqual({
      amount: "25.00",
      type: "final",
    });
  });

  it("accepts cents through the exact outstanding amount", () => {
    expect(isPaymentAmountValid("0.01", Money.fromEuros(25))).toBe(true);
    expect(isPaymentAmountValid("25.00", Money.fromEuros(25))).toBe(true);
  });

  it("rejects empty, malformed, zero, negative and over-outstanding amounts", () => {
    const outstanding = Money.fromEuros(25);
    expect(isPaymentAmountValid("", outstanding)).toBe(false);
    expect(isPaymentAmountValid("abc", outstanding)).toBe(false);
    expect(isPaymentAmountValid("0", outstanding)).toBe(false);
    expect(isPaymentAmountValid("-1", outstanding)).toBe(false);
    expect(isPaymentAmountValid("25.01", outstanding)).toBe(false);
  });

  it("explains whether confirmation needs a valid amount or a lower amount", () => {
    const outstanding = Money.fromEuros(25);
    expect(paymentAmountIssue("", outstanding)).toBe("invalid");
    expect(paymentAmountIssue("0", outstanding)).toBe("invalid");
    expect(paymentAmountIssue("25.01", outstanding)).toBe("overOutstanding");
    expect(paymentAmountIssue("25", outstanding)).toBeNull();
  });

  it("only shows the form while money is outstanding", () => {
    expect(shouldShowPaymentForm(Money.fromEuros(0.01))).toBe(true);
    expect(shouldShowPaymentForm(Money.zero())).toBe(false);
  });
});

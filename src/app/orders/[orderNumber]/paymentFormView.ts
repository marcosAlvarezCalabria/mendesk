import type { Money } from "@/domain/values/Money";
import type { PaymentType } from "@/domain/values/PaymentType";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type PaymentFormDefaults = {
  amount: string;
  type: PaymentType;
};

export type PaymentAmountIssue = "invalid" | "overOutstanding" | null;

export function paymentFormDefaults(status: OrderStatusValue, outstanding: Money): PaymentFormDefaults {
  return {
    amount: status === "ready" ? outstanding.toString() : "",
    type: status === "ready" ? "final" : "deposit",
  };
}

export function isPaymentAmountValid(value: string, outstanding: Money): boolean {
  return paymentAmountIssue(value, outstanding) === null;
}

export function paymentAmountIssue(value: string, outstanding: Money): PaymentAmountIssue {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return "invalid";

  const cents = Math.round(Number(value) * 100);
  if (cents <= 0) return "invalid";
  if (cents > outstanding.cents) return "overOutstanding";
  return null;
}

export function shouldShowPaymentForm(outstanding: Money): boolean {
  return !outstanding.isZero();
}

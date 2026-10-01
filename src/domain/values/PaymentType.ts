export type PaymentType = "deposit" | "final";

export const PAYMENT_TYPES: readonly PaymentType[] = ["deposit", "final"];

export function isPaymentType(value: string): value is PaymentType {
  return PAYMENT_TYPES.includes(value as PaymentType);
}

export type PaymentMethod = "cash" | "card";

export const PAYMENT_METHODS: readonly PaymentMethod[] = ["cash", "card"];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return PAYMENT_METHODS.includes(value as PaymentMethod);
}

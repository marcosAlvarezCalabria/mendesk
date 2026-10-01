import type { Money } from "@/domain/values/Money";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";
import type { PaymentType } from "@/domain/values/PaymentType";

export type Payment = {
  readonly id: string;
  readonly orderId?: string;
  readonly type: PaymentType;
  readonly amount: Money;
  readonly method: PaymentMethod;
  readonly createdAt: Date;
};
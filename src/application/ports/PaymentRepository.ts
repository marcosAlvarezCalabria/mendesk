import type { Payment } from "@/domain/entities/Payment";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import type { Money } from "@/domain/values/Money";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";
import type { PaymentType } from "@/domain/values/PaymentType";

export type NewPayment = {
  idempotencyKey: IdempotencyKey;
  orderId: string;
  type: PaymentType;
  amount: Money;
  method: PaymentMethod;
};

export interface PaymentRepository {
  getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Payment | null>;
  create(payment: NewPayment): Promise<Payment>;
  delete(paymentId: string): Promise<void>;
}

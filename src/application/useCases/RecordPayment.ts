import { createIdempotently } from "@/application/mutations/createIdempotently";
import type { PaymentRepository } from "@/application/ports/PaymentRepository";
import type { Payment } from "@/domain/entities/Payment";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import { isPaymentMethod } from "@/domain/values/PaymentMethod";
import { isPaymentType } from "@/domain/values/PaymentType";

export type RecordPaymentInput = {
  orderId: string;
  idempotencyKey: string;
  type: string;
  amountEuros: number;
  method: string;
};

export class RecordPayment {
  constructor(private readonly payments: PaymentRepository) {}

  async execute(input: RecordPaymentInput): Promise<Payment> {
    const idempotencyKey = IdempotencyKey.fromString(input.idempotencyKey);
    const amount = Money.fromEuros(input.amountEuros);

    if (amount.isZero()) {
      throw new Error("Payment amount must be greater than zero.");
    }

    if (!isPaymentType(input.type)) {
      throw new Error("Invalid payment type.");
    }

    if (!isPaymentMethod(input.method)) {
      throw new Error("Invalid payment method.");
    }

    const type = input.type;
    const method = input.method;

    return createIdempotently({
      lookup: () => this.payments.getByIdempotencyKey(idempotencyKey),
      create: () => this.payments.create({
        idempotencyKey,
        orderId: input.orderId,
        type,
        amount,
        method,
      }),
      isCompatible: (payment) => payment.orderId === input.orderId
        && payment.type === type
        && payment.amount.equals(amount)
        && payment.method === method,
    });
  }
}

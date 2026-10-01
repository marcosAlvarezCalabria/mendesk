import type { NewPayment, PaymentRepository } from "@/application/ports/PaymentRepository";
import type { Payment } from "@/domain/entities/Payment";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { mapPayment } from "@/infrastructure/directus/orderMapper";
import type { DirectusPaymentGateway } from "@/infrastructure/directus/DirectusPaymentGateway";

export class DirectusPaymentRepository implements PaymentRepository {
  constructor(private readonly gateway: DirectusPaymentGateway) {}

  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Payment | null> {
    const record = await this.gateway.getPaymentByIdempotencyKey(idempotencyKey.value);

    return record ? mapPayment(record) : null;
  }

  async create(payment: NewPayment): Promise<Payment> {
    const record = await this.gateway.createPayment({
      order: payment.orderId,
      type: payment.type,
      idempotency_key: payment.idempotencyKey.value,
      amount: payment.amount.toEuros(),
      method: payment.method,
    });

    if (!record) {
      throw new Error("Created Directus payment did not return a record");
    }

    return mapPayment(record);
  }

  async delete(paymentId: string): Promise<void> {
    await this.gateway.deletePayment(paymentId);
  }
}

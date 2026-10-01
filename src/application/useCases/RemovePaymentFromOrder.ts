import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { PaymentRepository } from "@/application/ports/PaymentRepository";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { PaymentNotFoundError } from "@/domain/errors/PaymentNotFoundError";
import { assertEditable } from "@/domain/orders/orderRules";

export type RemovePaymentFromOrderInput = {
  orderNumber: string;
  paymentId: string;
};

export class RemovePaymentFromOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async execute(input: RemovePaymentFromOrderInput): Promise<void> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);
    if (!order) throw new OrderNotFoundError();

    assertEditable(order);
    if (!order.payments.some((payment) => payment.id === input.paymentId)) {
      throw new PaymentNotFoundError();
    }

    try {
      await this.payments.delete(input.paymentId);
    } catch (mutationError) {
      let persistedOrder;
      try {
        persistedOrder = await this.orders.getByOrderNumber(input.orderNumber);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError([mutationError, reconciliationError], "The payment removal and its reconciliation both failed."),
        });
      }

      if (persistedOrder && !persistedOrder.payments.some((payment) => payment.id === input.paymentId)) return;
      throw new MutationConfirmedNotSavedError({ cause: mutationError });
    }
  }
}

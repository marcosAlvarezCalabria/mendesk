import type { OrderRepository } from "@/application/ports/OrderRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { Order } from "@/domain/entities/Order";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { assertDueDate, assertEditable } from "@/domain/orders/orderRules";

export type EditOrderDetailsInput = {
  orderNumber: string;
  expectedDateUpdated: Date;
  dueDate: Date | null | undefined;
  notes?: string;
};

export class EditOrderDetails {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: EditOrderDetailsInput): Promise<Order> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertEditable(order);
    const dueDate = assertDueDate(input.dueDate);

    try {
      return await this.orders.updateDetails({
        orderId: order.id,
        expectedDateUpdated: input.expectedDateUpdated,
        dueDate,
        notes: input.notes,
      });
    } catch (mutationError) {
      let persisted: Order | null;
      try {
        persisted = await this.orders.getByOrderNumber(input.orderNumber);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError(
            [mutationError, reconciliationError],
            "The order-details update and its reconciliation both failed.",
          ),
        });
      }

      if (!persisted) {
        throw new OrderConflictError();
      }
      if (
        persisted.dueDate.getTime() === dueDate.getTime()
        && persisted.notes === input.notes
      ) {
        return persisted;
      }
      if (persisted.dateUpdated.getTime() === input.expectedDateUpdated.getTime()) {
        throw new MutationConfirmedNotSavedError({ cause: mutationError });
      }
      throw new OrderConflictError();
    }
  }
}

import type { OrderRepository } from "@/application/ports/OrderRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { Order } from "@/domain/entities/Order";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { OrderStatus } from "@/domain/values/OrderStatus";

export type ChangeOrderStatusInput = { orderNumber: string; target: string; expectedStatus?: string; expectedDateUpdated?: string };

const ORDER_STATUSES: Record<string, OrderStatus> = {
  received: OrderStatus.RECEIVED,
  ready: OrderStatus.READY,
  collected: OrderStatus.COLLECTED,
  cancelled: OrderStatus.CANCELLED,
};

export class ChangeOrderStatus {
  constructor(private readonly orders: OrderRepository) {}

  async execute(input: ChangeOrderStatusInput): Promise<Order> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    const target = ORDER_STATUSES[input.target];

    if (!target) {
      throw new Error("Invalid order status.");
    }

    const expectedStatus = ORDER_STATUSES[input.expectedStatus ?? order.status.value];
    if (!expectedStatus) throw new Error("Invalid expected order status.");
    const status = expectedStatus.transitionTo(target);
    const expectedDateUpdated = input.expectedDateUpdated ? new Date(input.expectedDateUpdated) : order.dateUpdated;

    try {
      return await this.orders.updateStatus({
        orderId: order.id,
        expectedStatus,
        expectedDateUpdated,
        status,
        collectedAt: status.equals(OrderStatus.COLLECTED) ? new Date() : undefined,
      });
    } catch (mutationError) {
      let persisted: Order | null;
      try {
        persisted = await this.orders.getByOrderNumber(input.orderNumber);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError(
            [mutationError, reconciliationError],
            "The status update and its reconciliation both failed.",
          ),
        });
      }

      if (!persisted) {
        throw new OrderConflictError();
      }
      if (persisted.status.equals(status)) {
        return persisted;
      }
      if (persisted.status.equals(expectedStatus) && persisted.dateUpdated.getTime() === expectedDateUpdated.getTime()) {
        throw new MutationConfirmedNotSavedError({ cause: mutationError });
      }
      throw new OrderConflictError();
    }
  }
}

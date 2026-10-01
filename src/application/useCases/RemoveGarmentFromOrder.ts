import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { GarmentNotFoundError } from "@/domain/errors/GarmentNotFoundError";
import { LastGarmentRemovalError } from "@/domain/errors/LastGarmentRemovalError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { assertEditable } from "@/domain/orders/orderRules";

export type RemoveGarmentFromOrderInput = {
  orderNumber: string;
  garmentId: string;
  expectedDateUpdated?: string;
};

export class RemoveGarmentFromOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly garments: GarmentRepository,
  ) {}

  async execute(input: RemoveGarmentFromOrderInput): Promise<void> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertEditable(order);

    const garment = order.garments.find((candidate) => candidate.id === input.garmentId);
    if (!garment) {
      throw new GarmentNotFoundError();
    }

    if (order.garments.length <= 1) {
      throw new LastGarmentRemovalError();
    }

    if (!garment.dateUpdated) {
      throw new GarmentNotFoundError("Garment version is unavailable");
    }

    try {
      const expectedDateUpdated = input.expectedDateUpdated ? new Date(input.expectedDateUpdated) : garment.dateUpdated;
      await this.garments.delete(input.garmentId, expectedDateUpdated);
    } catch (mutationError) {
      let persistedOrder;
      try {
        persistedOrder = await this.orders.getByOrderNumber(input.orderNumber);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError(
            [mutationError, reconciliationError],
            "The garment removal and its reconciliation both failed.",
          ),
        });
      }

      if (!persistedOrder) {
        throw new ConcurrentGarmentModificationError();
      }

      const persisted = persistedOrder.garments.find((candidate) => candidate.id === input.garmentId);
      if (!persisted) {
        return;
      }
      const expectedDateUpdated = input.expectedDateUpdated ? new Date(input.expectedDateUpdated) : garment.dateUpdated;
      if (persisted.dateUpdated.getTime() === expectedDateUpdated.getTime()) {
        throw new MutationConfirmedNotSavedError({ cause: mutationError });
      }
      throw new ConcurrentGarmentModificationError();
    }
  }
}

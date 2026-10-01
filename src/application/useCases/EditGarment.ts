import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { Garment } from "@/domain/entities/Garment";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { GarmentNotFoundError } from "@/domain/errors/GarmentNotFoundError";
import { assertEditable } from "@/domain/orders/orderRules";
import { toAlterationType } from "@/domain/values/AlterationType";
import { Money } from "@/domain/values/Money";

export type EditGarmentInput = {
  orderNumber: string;
  garmentId: string;
  expectedDateUpdated: Date;
  description: string;
  alterationType: string;
  measurements?: string;
  priceEuros: number;
};

export class EditGarment {
  constructor(private readonly orders: OrderRepository, private readonly garments: GarmentRepository) {}

  async execute(input: EditGarmentInput): Promise<Garment> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    assertEditable(order);

    const garment = order.garments.find((candidate) => candidate.id === input.garmentId);

    if (!garment) {
      throw new GarmentNotFoundError();
    }

    if (!garment.dateUpdated) {
      throw new GarmentNotFoundError("Garment version is unavailable");
    }

    const description = input.description.trim();

    if (!description) {
      throw new Error("Garment description is required");
    }

    const price = Money.fromEuros(input.priceEuros);

    const alterationType = toAlterationType(input.alterationType);
    try {
      return await this.garments.update({
        expectedDateUpdated: input.expectedDateUpdated,
        garmentId: input.garmentId,
        description,
        alterationType,
        measurements: input.measurements,
        price,
      });
    } catch (mutationError) {
      let persistedOrder;
      try {
        persistedOrder = await this.orders.getByOrderNumber(input.orderNumber);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError(
            [mutationError, reconciliationError],
            "The garment update and its reconciliation both failed.",
          ),
        });
      }

      const persisted = persistedOrder?.garments.find((candidate) => candidate.id === input.garmentId);
      if (!persisted) {
        throw new ConcurrentGarmentModificationError();
      }
      if (
        persisted.description === description
        && persisted.alterationType === alterationType
        && persisted.measurements === input.measurements
        && persisted.price.equals(price)
      ) {
        return persisted;
      }
      if (persisted.dateUpdated.getTime() === input.expectedDateUpdated.getTime()) {
        throw new MutationConfirmedNotSavedError({ cause: mutationError });
      }
      throw new ConcurrentGarmentModificationError();
    }
  }
}

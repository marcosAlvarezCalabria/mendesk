import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { Garment } from "@/domain/entities/Garment";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { mapGarment } from "@/infrastructure/directus/orderMapper";
import type { DirectusGarmentGateway } from "@/infrastructure/directus/DirectusGarmentGateway";

export class DirectusGarmentRepository implements GarmentRepository {
  constructor(private readonly gateway: DirectusGarmentGateway) {}

  async getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Garment | null> {
    const record = await this.gateway.getGarmentByIdempotencyKey(idempotencyKey.value);

    return record ? mapGarment(record) : null;
  }

  async create(garment: NewGarment): Promise<Garment> {
    const record = await this.gateway.createGarment({
      order: garment.orderId,
      description: garment.description,
      idempotency_key: garment.idempotencyKey.value,
      alteration_type: garment.alterationType,
      measurements: garment.measurements,
      price: garment.price.toEuros(),
      photo: garment.photoId,
    });

    return mapGarment(record);
  }

  async update(input: UpdateGarment): Promise<Garment> {
    const record = await this.gateway.updateGarment(
      input.garmentId,
      input.expectedDateUpdated.toISOString(),
      {
        description: input.description,
        alteration_type: input.alterationType,
        measurements: input.measurements,
        price: input.price.toEuros(),
      },
    );

    if (!record) {
      throw new ConcurrentGarmentModificationError();
    }

    return mapGarment(record);
  }

  async delete(garmentId: string, expectedDateUpdated: Date): Promise<void> {
    const result = await this.gateway.deleteGarment(garmentId, expectedDateUpdated.toISOString());

    if (result === "conflict") {
      throw new ConcurrentGarmentModificationError();
    }
  }
}

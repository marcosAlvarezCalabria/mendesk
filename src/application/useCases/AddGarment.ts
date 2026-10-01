import { createIdempotently } from "@/application/mutations/createIdempotently";
import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import type { Garment } from "@/domain/entities/Garment";
import { Money } from "@/domain/values/Money";
import { toAlterationType } from "@/domain/values/AlterationType";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";

export type AddGarmentInput = {
  orderId: string;
  idempotencyKey: string;
  description: string;
  alterationType: string;
  measurements?: string;
  priceEuros: number;
  photoId?: string;
  acceptExistingPhoto?: boolean;
};

export class AddGarment {
  constructor(private readonly garments: GarmentRepository) {}

  async execute(input: AddGarmentInput): Promise<Garment> {
    const idempotencyKey = IdempotencyKey.fromString(input.idempotencyKey);
    const description = input.description.trim();

    if (!description) {
      throw new Error("Garment description is required");
    }

    const alterationType = toAlterationType(input.alterationType);
    const price = Money.fromEuros(input.priceEuros);

    return createIdempotently({
      lookup: () => this.garments.getByIdempotencyKey(idempotencyKey),
      create: () => this.garments.create({
        orderId: input.orderId,
        description,
        alterationType,
        measurements: input.measurements,
        idempotencyKey,
        price,
        photoId: input.photoId,
      }),
      isCompatible: (garment) => garment.orderId === input.orderId
        && garment.description === description
        && garment.alterationType === alterationType
        && garment.measurements === input.measurements
        && garment.price.equals(price)
        && (input.acceptExistingPhoto
          ? Boolean(garment.photoId) === Boolean(input.photoId)
          : garment.photoId === input.photoId),
    });
  }
}
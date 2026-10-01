import type { GarmentRepository } from "@/application/ports/GarmentRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import type { PhotoStorage, PhotoUpload } from "@/application/ports/PhotoStorage";
import { AddGarment, type AddGarmentInput } from "@/application/useCases/AddGarment";
import type { Garment } from "@/domain/entities/Garment";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";

export const ORDER_GARMENT_CONCURRENCY = 2;

export type OrderGarmentPhoto = {
  load(): Promise<PhotoUpload>;
};

export type OrderGarmentInput = Omit<AddGarmentInput, "orderId" | "photoId"> & {
  photo?: OrderGarmentPhoto;
};

export type OrderGarmentFailure = {
  index: number;
  stage: "photo" | "garment";
  cause: unknown;
};

export class OrderGarmentProcessingError extends Error {
  constructor(readonly failures: readonly OrderGarmentFailure[]) {
    super(`Could not process garment positions: ${failures.map((failure) => failure.index + 1).join(", ")}`);
    this.name = "OrderGarmentProcessingError";
  }
}

export class AddOrderGarments {
  private readonly addGarment: AddGarment;

  constructor(
    private readonly garments: GarmentRepository,
    private readonly photos: PhotoStorage,
  ) {
    this.addGarment = new AddGarment(garments);
  }

  async execute(input: { orderId: string; garments: readonly OrderGarmentInput[] }): Promise<Garment[]> {
    const results = new Array<Garment>(input.garments.length);
    const failures: OrderGarmentFailure[] = [];
    let nextIndex = 0;

    const worker = async () => {
      while (nextIndex < input.garments.length) {
        const index = nextIndex;
        nextIndex += 1;
        const garment = input.garments[index];

        if (!garment) {
          continue;
        }

        let uploadedPhotoId: string | undefined;
        let stage: OrderGarmentFailure["stage"] = "garment";

        try {
          const existing = await this.garments.getByIdempotencyKey(
            IdempotencyKey.fromString(garment.idempotencyKey),
          );

          if (existing) {
            results[index] = await this.addGarment.execute({
              orderId: input.orderId,
              description: garment.description,
              idempotencyKey: garment.idempotencyKey,
              alterationType: garment.alterationType,
              measurements: garment.measurements,
              priceEuros: garment.priceEuros,
              photoId: existing.photoId,
            });
            continue;
          }

          stage = garment.photo ? "photo" : "garment";
          uploadedPhotoId = garment.photo ? await this.photos.upload(await garment.photo.load()) : undefined;
          stage = "garment";
          const saved = await this.addGarment.execute({
            orderId: input.orderId,
            description: garment.description,
            idempotencyKey: garment.idempotencyKey,
            alterationType: garment.alterationType,
            measurements: garment.measurements,
            priceEuros: garment.priceEuros,
            photoId: uploadedPhotoId,
            acceptExistingPhoto: true,
          });

          if (uploadedPhotoId && saved.photoId !== uploadedPhotoId) {
            stage = "photo";
            await this.photos.delete(uploadedPhotoId);
          }
          results[index] = saved;
        } catch (cause) {
          if (uploadedPhotoId && cause instanceof MutationConfirmedNotSavedError) {
            try {
              await this.photos.delete(uploadedPhotoId);
            } catch (cleanupCause) {
              failures.push({ index, stage: "photo", cause: cleanupCause });
              continue;
            }
          }
          failures.push({ index, stage, cause });
        }
      }
    };

    const workerCount = Math.min(ORDER_GARMENT_CONCURRENCY, input.garments.length);
    await Promise.all(Array.from({ length: workerCount }, worker));

    if (failures.length > 0) {
      failures.sort((left, right) => left.index - right.index);
      throw new OrderGarmentProcessingError(failures);
    }

    return results;
  }
}

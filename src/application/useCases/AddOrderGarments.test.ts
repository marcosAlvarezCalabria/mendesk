import { describe, expect, it, vi } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { PhotoStorage, PhotoUpload } from "@/application/ports/PhotoStorage";
import {
  AddOrderGarments,
  ORDER_GARMENT_CONCURRENCY,
  type OrderGarmentInput,
} from "@/application/useCases/AddOrderGarments";
import type { Garment } from "@/domain/entities/Garment";
import { Money } from "@/domain/values/Money";

describe("AddOrderGarments", () => {
  it("keeps each optional photo associated with its source garment", async () => {
    const garments = new RecordingGarmentRepository();
    const photos = new RecordingPhotoStorage();
    const useCase = new AddOrderGarments(garments, photos);

    const result = await useCase.execute({
      orderId: "order-1",
      garments: [makeInput("Dress", "dress.jpg"), makeInput("Trousers")],
    });

    expect(result.map((garment) => ({ description: garment.description, photoId: garment.photoId }))).toEqual([
      { description: "Dress", photoId: "file-dress.jpg" },
      { description: "Trousers", photoId: undefined },
    ]);
  });

  it("never exceeds the fixed upload concurrency limit", async () => {
    const garments = new RecordingGarmentRepository();
    const photos = new RecordingPhotoStorage(5);
    const useCase = new AddOrderGarments(garments, photos);

    await useCase.execute({
      orderId: "order-1",
      garments: [makeInput("One", "1.jpg"), makeInput("Two", "2.jpg"), makeInput("Three", "3.jpg"), makeInput("Four", "4.jpg")],
    });

    expect(photos.maxActiveUploads).toBe(ORDER_GARMENT_CONCURRENCY);
    expect(garments.created).toHaveLength(4);
  });

  it("continues independent garments and reports a failed upload without creating that garment", async () => {
    const garments = new RecordingGarmentRepository();
    const photos = new RecordingPhotoStorage(0, new Set(["broken.jpg"]));
    const useCase = new AddOrderGarments(garments, photos);

    const result = useCase.execute({
      orderId: "order-1",
      garments: [makeInput("Dress", "broken.jpg"), makeInput("Trousers")],
    });

    await expect(result).rejects.toMatchObject({
      failures: [{ index: 0, stage: "photo" }],
    });
    expect(garments.created.map((garment) => garment.description)).toEqual(["Trousers"]);
  });

  it("sorts concurrent failures by source position", async () => {
    const garments = new RecordingGarmentRepository(new Set(["One", "Three"]));
    const useCase = new AddOrderGarments(garments, new RecordingPhotoStorage());

    const result = useCase.execute({
      orderId: "order-1",
      garments: [makeInput("One"), makeInput("Two"), makeInput("Three")],
    });

    await expect(result).rejects.toEqual(
      expect.objectContaining({
        failures: [
          expect.objectContaining({ index: 0, stage: "garment" }),
          expect.objectContaining({ index: 2, stage: "garment" }),
        ],
      }),
    );
  });

  it("reconciles an existing garment before loading or uploading its photo", async () => {
    const existing: Garment = {
      id: "garment-existing",
      orderId: "order-1",
      description: "Dress",
      alterationType: "hem",
      measurements: undefined,
      price: Money.fromEuros(25),
      photoId: "file-original.jpg",
      dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    };
    const garments = new RecordingGarmentRepository(new Set(), existing);
    const photos = new RecordingPhotoStorage();
    const load = vi.fn(async () => ({ bytes: new Uint8Array([1]), filename: "retry.jpg", contentType: "image/jpeg" }));
    const useCase = new AddOrderGarments(garments, photos);

    await expect(useCase.execute({
      orderId: "order-1",
      garments: [{ ...makeInput("Dress"), photo: { load } }],
    })).resolves.toEqual([existing]);

    expect(load).not.toHaveBeenCalled();
    expect(photos.uploaded).toEqual([]);
    expect(garments.created).toEqual([]);
  });

  it("deletes only the losing upload when concurrent retries persist another photo", async () => {
    const garments = new ConcurrentGarmentRepository();
    const photos = new SequencedPhotoStorage();
    const useCase = new AddOrderGarments(garments, photos);
    const input = { orderId: "order-1", garments: [makeInput("Dress", "dress.jpg")] };

    const [first, second] = await Promise.all([
      useCase.execute(input),
      useCase.execute(input),
    ]);

    const persistedPhotoId = garments.persisted?.photoId;
    expect(first[0]?.photoId).toBe(persistedPhotoId);
    expect(second[0]?.photoId).toBe(persistedPhotoId);
    expect(photos.uploadedIds).toHaveLength(2);
    expect(photos.deletedIds).toEqual(photos.uploadedIds.filter((id) => id !== persistedPhotoId));
    expect(photos.deletedIds).not.toContain(persistedPhotoId);
  });

  it("deletes an uploaded photo when Directus confirms the garment was not saved", async () => {
    const garments = new RecordingGarmentRepository(new Set(["Dress"]), null, new MutationConfirmedNotSavedError());
    const photos = new RecordingPhotoStorage();
    const useCase = new AddOrderGarments(garments, photos);

    const result = useCase.execute({
      orderId: "order-1",
      garments: [makeInput("Dress", "dress.jpg")],
    });

    await expect(result).rejects.toMatchObject({
      failures: [{ index: 0, stage: "garment" }],
    });
    expect(photos.deleted).toEqual(["file-dress.jpg"]);
  });
});

class ConcurrentGarmentRepository implements GarmentRepository {
  persisted: Garment | null = null;
  async getByIdempotencyKey(): Promise<Garment | null> { return this.persisted; }
  async create(garment: NewGarment): Promise<Garment> {
    if (this.persisted) throw new Error("unique conflict");
    this.persisted = { id: "garment-winner", ...garment, dateUpdated: new Date("2026-09-05T10:00:00.000Z") };
    return this.persisted;
  }
  async update(input: UpdateGarment): Promise<Garment> { void input; throw new Error("Not implemented"); }
  async delete(garmentId: string): Promise<void> { void garmentId; }
}

class SequencedPhotoStorage implements PhotoStorage {
  readonly uploadedIds: string[] = [];
  readonly deletedIds: string[] = [];
  async upload(): Promise<string> {
    const id = `file-${this.uploadedIds.length + 1}`;
    this.uploadedIds.push(id);
    return id;
  }
  async delete(photoId: string): Promise<void> { this.deletedIds.push(photoId); }
  async getSignedUrl(photoId: string): Promise<string> { return photoId; }
  async matches(): Promise<boolean> { return false; }
}
class RecordingGarmentRepository implements GarmentRepository {
  async getByIdempotencyKey(): Promise<Garment | null> {
    return this.existing;
  }

  readonly created: NewGarment[] = [];

  constructor(
    private readonly failures = new Set<string>(),
    private readonly existing: Garment | null = null,
    private readonly failureError: Error = new Error("Could not create garment"),
  ) {}

  async create(garment: NewGarment): Promise<Garment> {
    if (this.failures.has(garment.description)) {
      throw this.failureError;
    }

    this.created.push(garment);
    return { id: `garment-${this.created.length}`, ...garment, dateUpdated: new Date("2026-09-05T10:00:00.000Z") };
  }

  async update(input: UpdateGarment): Promise<Garment> {
    void input;
    throw new Error("Not implemented");
  }

  async delete(garmentId: string): Promise<void> {
    void garmentId;
  }
}

class RecordingPhotoStorage implements PhotoStorage {
  activeUploads = 0;
  maxActiveUploads = 0;
  readonly uploaded: PhotoUpload[] = [];
  readonly deleted: string[] = [];

  constructor(
    private readonly delayMs = 0,
    private readonly failures = new Set<string>(),
  ) {}

  async upload(photo: PhotoUpload): Promise<string> {
    this.uploaded.push(photo);
    this.activeUploads += 1;
    this.maxActiveUploads = Math.max(this.maxActiveUploads, this.activeUploads);

    try {
      if (this.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.delayMs));
      }

      if (this.failures.has(photo.filename)) {
        throw new Error(`Could not upload ${photo.filename}`);
      }

      return `file-${photo.filename}`;
    } finally {
      this.activeUploads -= 1;
    }
  }

  async delete(photoId: string): Promise<void> {
    this.deleted.push(photoId);
  }

  async getSignedUrl(photoId: string): Promise<string> {
    return photoId;
  }

  async matches(): Promise<boolean> {
    return false;
  }
}

function makeInput(description: string, filename?: string): OrderGarmentInput {
  return {
    idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
    description,
    alterationType: "hem",
    measurements: undefined,
    priceEuros: 25,
    photo: filename
      ? { load: async () => ({ bytes: new Uint8Array([1, 2, 3]), filename, contentType: "image/jpeg" }) }
      : undefined,
  };
}

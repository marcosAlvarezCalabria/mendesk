import { describe, expect, it } from "vitest";

import type { NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import type { DirectusGarmentCreatePayload, DirectusGarmentGateway, DirectusGarmentUpdatePayload } from "@/infrastructure/directus/DirectusGarmentGateway";
import { DirectusGarmentRepository } from "@/infrastructure/directus/DirectusGarmentRepository";
import type { DirectusGarmentRecord } from "@/infrastructure/directus/records";

describe("DirectusGarmentRepository", () => {
  it("creates a garment through the Directus gateway and returns the domain garment", async () => {
    const gateway = new FakeDirectusGarmentGateway({ id: "garment-1", date_updated: "2026-09-05T10:00:00.000Z", description: "Blue dress", alteration_type: "hem", measurements: "Hem 4cm", photo: "file-1", price: 25 });
    const repository = new DirectusGarmentRepository(gateway);
    const idempotencyKey = IdempotencyKey.fromString("550e8400-e29b-41d4-a716-446655440000");
    const input: NewGarment = { idempotencyKey, orderId: "order-1", description: "Blue dress", alterationType: "hem", measurements: "Hem 4cm", price: Money.fromEuros(25), photoId: "file-1" };

    const garment = await repository.create(input);

    expect(gateway.lastPayload).toEqual({ idempotency_key: idempotencyKey.value, order: "order-1", description: "Blue dress", alteration_type: "hem", measurements: "Hem 4cm", price: 25, photo: "file-1" });
    expect(garment.id).toBe("garment-1");
    expect(garment.description).toBe("Blue dress");
    expect(garment.alterationType).toBe("hem");
    expect(garment.price.toEuros()).toBe(25);
  });

  it("updates a garment through the Directus gateway and returns the domain garment from the input", async () => {
    const gateway = new FakeDirectusGarmentGateway({ id: "garment-1", date_updated: "2026-09-05T10:00:00.000Z", description: "Dress", alteration_type: "hem", measurements: null, photo: null, price: 25 });
    const repository = new DirectusGarmentRepository(gateway);
    const input: UpdateGarment = { garmentId: "garment-1", expectedDateUpdated: new Date("2026-09-05T10:00:00.000Z"), description: "Blue dress", alterationType: "waist", measurements: "Take in 2cm", price: Money.fromEuros(30) };

    const garment = await repository.update(input);

    expect(gateway.lastUpdateId).toBe("garment-1");
    expect(gateway.lastUpdatePayload).toEqual({ description: "Blue dress", alteration_type: "waist", measurements: "Take in 2cm", price: 30 });
    expect(garment).toEqual({ id: "garment-1", dateUpdated: new Date("2026-09-05T10:01:00.000Z"), description: "Blue dress", alterationType: "waist", measurements: "Take in 2cm", price: Money.fromEuros(30) });
  });

  it("deletes a garment through the Directus gateway", async () => {
    const gateway = new FakeDirectusGarmentGateway({ id: "garment-1", date_updated: "2026-09-05T10:00:00.000Z", description: "Dress", alteration_type: "hem", measurements: null, photo: null, price: 25 });
    const repository = new DirectusGarmentRepository(gateway);

    await repository.delete("garment-1", new Date("2026-09-05T10:00:00.000Z"));

    expect(gateway.lastDeleteId).toBe("garment-1");
  });
});

class FakeDirectusGarmentGateway implements DirectusGarmentGateway {
  async getGarmentByIdempotencyKey(): Promise<DirectusGarmentRecord | null> {
    return null;
  }
  lastPayload: DirectusGarmentCreatePayload | null = null;
  lastDeleteId: string | null = null;
  lastDeleteExpectedDateUpdated: string | null = null;
  lastUpdateExpectedDateUpdated: string | null = null;
  lastUpdateId: string | null = null;
  lastUpdatePayload: DirectusGarmentUpdatePayload | null = null;

  constructor(private readonly record: DirectusGarmentRecord) {}

  async createGarment(payload: DirectusGarmentCreatePayload): Promise<DirectusGarmentRecord> {
    this.lastPayload = payload;
    return this.record;
  }

  async updateGarment(id: string, expectedDateUpdated: string, payload: DirectusGarmentUpdatePayload): Promise<DirectusGarmentRecord> {
    this.lastUpdateId = id;
    this.lastUpdateExpectedDateUpdated = expectedDateUpdated;
    this.lastUpdatePayload = payload;
    return { ...this.record, ...payload, date_updated: "2026-09-05T10:01:00.000Z" };
  }

  async deleteGarment(id: string, expectedDateUpdated: string): Promise<"deleted"> {
    this.lastDeleteId = id;
    this.lastDeleteExpectedDateUpdated = expectedDateUpdated;
    return "deleted";
  }
}

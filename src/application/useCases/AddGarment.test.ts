import { describe, expect, it } from "vitest";

import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import { AddGarment } from "@/application/useCases/AddGarment";
import type { Garment } from "@/domain/entities/Garment";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";

describe("AddGarment", () => {
  it("creates a garment with mapped alteration type and Money price", async () => {
    const garments = new FakeGarmentRepository();
    const useCase = new AddGarment(garments);

    const garment = await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", description: " Blue dress ", alterationType: "hem", measurements: "Hem 4cm", priceEuros: 25, photoId: "file-1" });

    expect(garments.created).toHaveLength(1);
    expect(garments.created[0]?.description).toBe("Blue dress");
    expect(garments.created[0]?.alterationType).toBe("hem");
    expect(garments.created[0]?.price.toString()).toBe("25.00");
    expect(garment.price.toString()).toBe("25.00");
  });

  it("falls back unknown alteration types to other", async () => {
    const garments = new FakeGarmentRepository();
    const useCase = new AddGarment(garments);

    await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", description: "Coat", alterationType: "lining", priceEuros: 30 });

    expect(garments.created[0]?.alterationType).toBe("other");
  });

  it("rejects blank descriptions before calling the repository", async () => {
    const garments = new FakeGarmentRepository();
    const useCase = new AddGarment(garments);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", description: "   ", alterationType: "hem", priceEuros: 25 })).rejects.toThrow("Garment description is required");
    expect(garments.created).toHaveLength(0);
  });

  it("propagates invalid prices", async () => {
    const garments = new FakeGarmentRepository();
    const useCase = new AddGarment(garments);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", description: "Dress", alterationType: "hem", priceEuros: -1 })).rejects.toThrow(InvalidMoneyError);
    expect(garments.created).toHaveLength(0);
  });
});

class FakeGarmentRepository implements GarmentRepository {
  async getByIdempotencyKey(): Promise<Garment | null> {
    return null;
  }

  readonly created: NewGarment[] = [];

  async create(garment: NewGarment): Promise<Garment> {
    this.created.push(garment);

    return {
      id: `garment-${this.created.length}`,
      orderId: garment.orderId,
      description: garment.description,
      dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
      alterationType: garment.alterationType,
      measurements: garment.measurements,
      photoId: garment.photoId,
      price: garment.price,
    };
  }

  async update(input: UpdateGarment): Promise<Garment> {
    void input;
    throw new Error("Not implemented");
  }

  async delete(garmentId: string): Promise<void> {
    void garmentId;
  }
}

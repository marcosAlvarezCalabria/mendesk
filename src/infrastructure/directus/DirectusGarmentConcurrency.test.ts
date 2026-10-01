import { describe, expect, it } from "vitest";

import type { UpdateGarment } from "@/application/ports/GarmentRepository";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { Money } from "@/domain/values/Money";
import type {
  DirectusGarmentGateway,
  DirectusGarmentUpdatePayload,
} from "@/infrastructure/directus/DirectusGarmentGateway";
import { DirectusGarmentRepository } from "@/infrastructure/directus/DirectusGarmentRepository";
import type { DirectusGarmentRecord } from "@/infrastructure/directus/records";

const VERSION = new Date("2026-09-05T10:00:00.000Z");
const NEXT_VERSION = "2026-09-05T10:01:00.000Z";

describe("DirectusGarmentRepository concurrency", () => {
  it("updates atomically from the expected version and maps the persisted response", async () => {
    const gateway = new ConditionalGateway(record({ date_updated: NEXT_VERSION }));
    const repository = new DirectusGarmentRepository(gateway);

    const garment = await repository.update(updateInput());

    expect(gateway.updateCall).toEqual({
      id: "garment-1",
      expectedDateUpdated: VERSION.toISOString(),
      payload: {
        description: "Blue dress",
        alteration_type: "waist",
        measurements: "Take in 2cm",
        price: 30,
      },
    });
    expect(garment.dateUpdated).toEqual(new Date(NEXT_VERSION));
  });

  it("reports a typed conflict when conditional update affects no garment", async () => {
    const repository = new DirectusGarmentRepository(new ConditionalGateway(null));

    await expect(repository.update(updateInput())).rejects.toBeInstanceOf(
      ConcurrentGarmentModificationError,
    );
  });

  it("deletes atomically from the expected version", async () => {
    const gateway = new ConditionalGateway(record());
    const repository = new DirectusGarmentRepository(gateway);

    await repository.delete("garment-1", VERSION);

    expect(gateway.deleteCall).toEqual({
      id: "garment-1",
      expectedDateUpdated: VERSION.toISOString(),
    });
  });

  it("reports a typed conflict when the conditional delete finds another version", async () => {
    const gateway = new ConditionalGateway(record());
    gateway.deleteResult = "conflict";
    const repository = new DirectusGarmentRepository(gateway);

    await expect(
      repository.delete("garment-1", VERSION),
    ).rejects.toBeInstanceOf(ConcurrentGarmentModificationError);
  });
});

class ConditionalGateway implements DirectusGarmentGateway {
  async getGarmentByIdempotencyKey(): Promise<DirectusGarmentRecord | null> {
    return null;
  }
  updateCall: {
    id: string;
    expectedDateUpdated: string;
    payload: DirectusGarmentUpdatePayload;
  } | null = null;
  deleteCall: { id: string; expectedDateUpdated: string } | null = null;
  deleteResult: "deleted" | "conflict" = "deleted";

  constructor(private readonly updatedRecord: DirectusGarmentRecord | null) {}

  async createGarment(): Promise<DirectusGarmentRecord> {
    throw new Error("Not implemented");
  }

  async updateGarment(
    id: string,
    expectedDateUpdated: string,
    payload: DirectusGarmentUpdatePayload,
  ): Promise<DirectusGarmentRecord | null> {
    this.updateCall = { id, expectedDateUpdated, payload };
    return this.updatedRecord;
  }

  async deleteGarment(id: string, expectedDateUpdated: string): Promise<"deleted" | "conflict"> {
    this.deleteCall = { id, expectedDateUpdated };
    return this.deleteResult;
  }
}

function updateInput(): UpdateGarment {
  return {
    garmentId: "garment-1",
    expectedDateUpdated: VERSION,
    description: "Blue dress",
    alterationType: "waist",
    measurements: "Take in 2cm",
    price: Money.fromEuros(30),
  };
}

function record(overrides: Partial<DirectusGarmentRecord> = {}): DirectusGarmentRecord {
  return {
    id: "garment-1",
    date_updated: VERSION.toISOString(),
    description: "Blue dress",
    alteration_type: "waist",
    measurements: "Take in 2cm",
    photo: null,
    price: 30,
    ...overrides,
  };
}

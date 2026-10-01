import { describe, expect, it } from "vitest";

import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import type { PhotoStorage, PhotoUpload } from "@/application/ports/PhotoStorage";
import { AddGarmentToOrder } from "@/application/useCases/AddGarmentToOrder";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("AddGarmentToOrder", () => {
  it("adds a garment to an editable order", async () => {
    const order = makeOrder();
    const garments = new RecordingGarmentRepository();
    const useCase = new AddGarmentToOrder(new FakeOrderRepository([order]), garments, new RecordingPhotoStorage());

    const garment = await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      orderNumber: order.orderNumber.value,
      description: "  Blue dress  ",
      alterationType: "waist",
      measurements: "Take in 2cm",
      priceEuros: 30,
    });

    expect(garments.created).toEqual([
      {
        idempotencyKey: expect.objectContaining({ value: "550e8400-e29b-41d4-a716-446655440000" }),
        orderId: order.id,
        description: "Blue dress",
        alterationType: "waist",
        measurements: "Take in 2cm",
        price: Money.fromEuros(30),
        photoId: undefined,
      },
    ]);
    expect(garment.description).toBe("Blue dress");
  });

  it("uploads an optional photo and associates it with the new garment", async () => {
    const order = makeOrder();
    const garments = new RecordingGarmentRepository();
    const photos = new RecordingPhotoStorage();
    const useCase = new AddGarmentToOrder(new FakeOrderRepository([order]), garments, photos);

    await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      orderNumber: order.orderNumber.value,
      description: "Dress",
      alterationType: "hem",
      priceEuros: 25,
      photo: { load: async () => makePhoto("dress.jpg") },
    });

    expect(photos.uploaded).toEqual([makePhoto("dress.jpg")]);
    expect(garments.created[0]?.photoId).toBe("file-dress.jpg");
  });

  it("rejects non-editable orders before uploading or creating", async () => {
    const order = makeOrder({ status: OrderStatus.COLLECTED });
    const garments = new RecordingGarmentRepository();
    const photos = new RecordingPhotoStorage();
    const useCase = new AddGarmentToOrder(new FakeOrderRepository([order]), garments, photos);

    const result = useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      orderNumber: order.orderNumber.value,
      description: "Dress",
      alterationType: "hem",
      priceEuros: 25,
      photo: { load: async () => makePhoto("dress.jpg") },
    });

    await expect(result).rejects.toBeInstanceOf(OrderNotEditableError);
    expect(photos.uploaded).toEqual([]);
    expect(garments.created).toEqual([]);
  });

  it("rejects a missing order without creating a garment", async () => {
    const garments = new RecordingGarmentRepository();
    const useCase = new AddGarmentToOrder(new FakeOrderRepository([]), garments, new RecordingPhotoStorage());

    await expect(
      useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
        orderNumber: "260829-9999",
        description: "Dress",
        alterationType: "hem",
        priceEuros: 25,
      }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(garments.created).toEqual([]);
  });
});

class FakeOrderRepository implements OrderRepository {
  async getByIdempotencyKey(): Promise<Order | null> {
    return null;
  }

  constructor(private readonly orders: readonly Order[]) {}

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    return this.orders.find((order) => order.orderNumber.value === orderNumber) ?? null;
  }

  async create(order: NewOrder): Promise<Order> {
    void order;
    throw new Error("Not implemented");
  }

  async updateDetails(input: UpdateOrderDetails): Promise<Order> {
    void input;
    throw new Error("Not implemented");
  }

  async updateStatus(input: UpdateOrderStatus): Promise<Order> {
    void input;
    throw new Error("Not implemented");
  }
}

class RecordingGarmentRepository implements GarmentRepository {
  async getByIdempotencyKey(): Promise<Garment | null> {
    return null;
  }

  readonly created: NewGarment[] = [];

  async create(garment: NewGarment): Promise<Garment> {
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
  readonly uploaded: PhotoUpload[] = [];

  async upload(photo: PhotoUpload): Promise<string> {
    this.uploaded.push(photo);
    return `file-${photo.filename}`;
  }
  async delete(photoId: string): Promise<void> {
    void photoId;
  }


  async getSignedUrl(photoId: string): Promise<string> {
    return photoId;
  }

  async matches(): Promise<boolean> {
    return false;
  }
}

function makePhoto(filename: string): PhotoUpload {
  return { bytes: new Uint8Array([1, 2, 3]), filename, contentType: "image/jpeg" };
}

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-08-29T10:00:00.000Z");

  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-31T10:00:00.000Z"),
    garments: [],
    payments: [],
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { EditGarment } from "@/application/useCases/EditGarment";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("EditGarment", () => {
  it("updates a garment for an editable order", async () => {
    const visibleVersion = new Date("2026-09-05T09:59:00.000Z");
    const order = makeOrder({});
    const orders = new FakeOrderRepository([order]);
    const garments = new FakeGarmentRepository();
    const useCase = new EditGarment(orders, garments);

    const garment = await useCase.execute({
      orderNumber: order.orderNumber.value,
      garmentId: "garment-1",
      expectedDateUpdated: visibleVersion,
      description: "  Blue dress  ",
      alterationType: "waist",
      measurements: "Take in 2cm",
      priceEuros: 30,
    });

    expect(garments.updated).toEqual([
      { garmentId: "garment-1", expectedDateUpdated: visibleVersion, description: "Blue dress", alterationType: "waist", measurements: "Take in 2cm", price: Money.fromEuros(30) },
    ]);
    expect(garment.description).toBe("Blue dress");
    expect(garment.alterationType).toBe("waist");
    expect(garment.price.toEuros()).toBe(30);
  });

  it("rejects non-editable orders without updating", async () => {
    const order = makeOrder({ status: OrderStatus.COLLECTED });
    const garments = new FakeGarmentRepository();
    const useCase = new EditGarment(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1", expectedDateUpdated: order.garments[0]!.dateUpdated, description: "Dress", alterationType: "hem", priceEuros: 25 }),
    ).rejects.toBeInstanceOf(OrderNotEditableError);
    expect(garments.updated).toEqual([]);
  });

  it("rejects empty descriptions without updating", async () => {
    const order = makeOrder({});
    const garments = new FakeGarmentRepository();
    const useCase = new EditGarment(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1", expectedDateUpdated: order.garments[0]!.dateUpdated, description: "   ", alterationType: "hem", priceEuros: 25 }),
    ).rejects.toThrow("Garment description is required");
    expect(garments.updated).toEqual([]);
  });

  it("rejects negative prices without updating", async () => {
    const order = makeOrder({});
    const garments = new FakeGarmentRepository();
    const useCase = new EditGarment(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1", expectedDateUpdated: order.garments[0]!.dateUpdated, description: "Dress", alterationType: "hem", priceEuros: -1 }),
    ).rejects.toBeInstanceOf(InvalidMoneyError);
    expect(garments.updated).toEqual([]);
  });

  it("returns the persisted garment when an ambiguous edit was saved", async () => {
    const order = makeOrder({});
    const persistedGarment = makeGarment({ description: "Blue dress", alterationType: "waist", measurements: "Take in 2cm", price: Money.fromEuros(30), dateUpdated: new Date("2026-09-05T11:00:00.000Z") });
    const persistedOrder = makeOrder({ garments: [persistedGarment] });
    const orders = new FakeOrderRepository([order], [order, persistedOrder]);
    const garments = new FakeGarmentRepository(new Error("timeout"));

    await expect(new EditGarment(orders, garments).execute({
      orderNumber: order.orderNumber.value,
      garmentId: "garment-1",
      expectedDateUpdated: order.garments[0]!.dateUpdated,
      description: "Blue dress",
      alterationType: "waist",
      measurements: "Take in 2cm",
      priceEuros: 30,
    })).resolves.toBe(persistedGarment);
  });

  it("confirms an ambiguous garment edit was not saved when its prior version remains", async () => {
    const order = makeOrder({});
    const orders = new FakeOrderRepository([order], [order, order]);
    const garments = new FakeGarmentRepository(new Error("timeout"));

    await expect(new EditGarment(orders, garments).execute({
      orderNumber: order.orderNumber.value,
      garmentId: "garment-1",
      expectedDateUpdated: order.garments[0]!.dateUpdated,
      description: "Blue dress",
      alterationType: "waist",
      priceEuros: 30,
    })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("reports a conflict when garment reconciliation finds an incompatible version", async () => {
    const order = makeOrder({});
    const incompatible = makeOrder({ garments: [makeGarment({ description: "Red dress", dateUpdated: new Date("2026-09-05T11:00:00.000Z") })] });
    const orders = new FakeOrderRepository([order], [order, incompatible]);
    const garments = new FakeGarmentRepository(new Error("timeout"));

    await expect(new EditGarment(orders, garments).execute({
      orderNumber: order.orderNumber.value,
      garmentId: "garment-1",
      expectedDateUpdated: order.garments[0]!.dateUpdated,
      description: "Blue dress",
      alterationType: "waist",
      priceEuros: 30,
    })).rejects.toBeInstanceOf(ConcurrentGarmentModificationError);
  });

  it("wraps a failed garment reconciliation as outcome unknown", async () => {
    const order = makeOrder({});
    const authError = Object.assign(new Error("expired"), { status: 401 });
    const orders = new FakeOrderRepository([order], [order, authError]);
    const garments = new FakeGarmentRepository(new Error("timeout"));

    const error = await new EditGarment(orders, garments).execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1", expectedDateUpdated: order.garments[0]!.dateUpdated, description: "Blue dress", alterationType: "waist", priceEuros: 30 }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(MutationOutcomeUnknownError);
    expect(((error as Error).cause as AggregateError).errors).toContain(authError);
  });
});

class FakeOrderRepository implements OrderRepository {
  async getByIdempotencyKey(): Promise<Order | null> {
    return null;
  }

  private readonly reads: unknown[];

  constructor(
    private readonly orders: readonly Order[],
    reads: unknown[] = [],
  ) {
    this.reads = [...reads];
  }

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    if (this.reads.length > 0) {
      const result = this.reads.shift();
      if (result instanceof Error || (typeof result === "object" && result !== null && typeof (result as { status?: unknown }).status === "number")) throw result;
      return (result as Order | null | undefined) ?? null;
    }
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

class FakeGarmentRepository implements GarmentRepository {
  async getByIdempotencyKey(): Promise<Garment | null> {
    return null;
  }

  readonly updated: UpdateGarment[] = [];

  constructor(private readonly updateError?: unknown) {}

  async create(garment: NewGarment): Promise<Garment> {
    void garment;
    throw new Error("Not implemented");
  }

  async update(input: UpdateGarment): Promise<Garment> {
    this.updated.push(input);
    if (this.updateError !== undefined) throw this.updateError;

    return {
      id: input.garmentId,
      description: input.description,
      dateUpdated: new Date("2026-09-05T10:01:00.000Z"),
      alterationType: input.alterationType,
      measurements: input.measurements,
      price: input.price,
    };
  }

  async delete(garmentId: string): Promise<void> {
    void garmentId;
  }
}

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Mary",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
  };
}

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: "garment-1",
    description: "Dress",
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    alterationType: "hem",
    price: Money.fromEuros(25),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-08-19T10:00:00.000Z");

  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [makeGarment()],
    payments: [],
    ...overrides,
  };
}

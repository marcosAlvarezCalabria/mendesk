import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { GarmentRepository, NewGarment, UpdateGarment } from "@/application/ports/GarmentRepository";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { RemoveGarmentFromOrder } from "@/application/useCases/RemoveGarmentFromOrder";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { ConcurrentGarmentModificationError } from "@/domain/errors/ConcurrentGarmentModificationError";
import { GarmentNotFoundError } from "@/domain/errors/GarmentNotFoundError";
import { LastGarmentRemovalError } from "@/domain/errors/LastGarmentRemovalError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("RemoveGarmentFromOrder", () => {
  it("removes a garment from an editable order that has another garment", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const garments = new RecordingGarmentRepository();
    const useCase = new RemoveGarmentFromOrder(new FakeOrderRepository([order]), garments);

    await useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-2" });

    expect(garments.deleted).toEqual([{ garmentId: "garment-2", expectedDateUpdated: new Date("2026-09-05T10:00:00.000Z") }]);
  });

  it("rejects removing the last garment", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1")] });
    const garments = new RecordingGarmentRepository();
    const useCase = new RemoveGarmentFromOrder(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1" }),
    ).rejects.toBeInstanceOf(LastGarmentRemovalError);
    expect(garments.deleted).toEqual([]);
  });

  it("rejects a garment that does not belong to the order", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const garments = new RecordingGarmentRepository();
    const useCase = new RemoveGarmentFromOrder(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-other" }),
    ).rejects.toBeInstanceOf(GarmentNotFoundError);
    expect(garments.deleted).toEqual([]);
  });

  it("rejects non-editable orders", async () => {
    const order = makeOrder({
      garments: [makeGarment("garment-1"), makeGarment("garment-2")],
      status: OrderStatus.COLLECTED,
    });
    const garments = new RecordingGarmentRepository();
    const useCase = new RemoveGarmentFromOrder(new FakeOrderRepository([order]), garments);

    await expect(
      useCase.execute({ orderNumber: order.orderNumber.value, garmentId: "garment-1" }),
    ).rejects.toBeInstanceOf(OrderNotEditableError);
    expect(garments.deleted).toEqual([]);
  });

  it("rejects a missing order", async () => {
    const garments = new RecordingGarmentRepository();
    const useCase = new RemoveGarmentFromOrder(new FakeOrderRepository([]), garments);

    await expect(
      useCase.execute({ orderNumber: "260829-9999", garmentId: "garment-1" }),
    ).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(garments.deleted).toEqual([]);
  });

  it("succeeds when reconciliation confirms an ambiguously removed garment is absent", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const persisted = makeOrder({ garments: [makeGarment("garment-1")] });
    const orders = new FakeOrderRepository([order], [order, persisted]);
    const garments = new RecordingGarmentRepository(new Error("timeout"));

    await expect(new RemoveGarmentFromOrder(orders, garments).execute({ orderNumber: order.orderNumber.value, garmentId: "garment-2" })).resolves.toBeUndefined();
  });

  it("confirms an ambiguous removal was not saved when the prior garment version remains", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const orders = new FakeOrderRepository([order], [order, order]);
    const garments = new RecordingGarmentRepository(new Error("timeout"));

    await expect(new RemoveGarmentFromOrder(orders, garments).execute({ orderNumber: order.orderNumber.value, garmentId: "garment-2" })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("reports a conflict when removal reconciliation finds a changed garment", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const changed = makeGarment("garment-2", { description: "Changed", dateUpdated: new Date("2026-09-05T11:00:00.000Z") });
    const persisted = makeOrder({ garments: [makeGarment("garment-1"), changed] });
    const orders = new FakeOrderRepository([order], [order, persisted]);
    const garments = new RecordingGarmentRepository(new Error("timeout"));

    await expect(new RemoveGarmentFromOrder(orders, garments).execute({ orderNumber: order.orderNumber.value, garmentId: "garment-2" })).rejects.toBeInstanceOf(ConcurrentGarmentModificationError);
  });

  it("wraps a failed removal reconciliation as outcome unknown", async () => {
    const order = makeOrder({ garments: [makeGarment("garment-1"), makeGarment("garment-2")] });
    const authError = Object.assign(new Error("expired"), { status: 401 });
    const orders = new FakeOrderRepository([order], [order, authError]);
    const garments = new RecordingGarmentRepository(new Error("timeout"));

    const error = await new RemoveGarmentFromOrder(orders, garments).execute({ orderNumber: order.orderNumber.value, garmentId: "garment-2" }).catch((cause: unknown) => cause);

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

class RecordingGarmentRepository implements GarmentRepository {
  async getByIdempotencyKey(): Promise<Garment | null> {
    return null;
  }

  readonly deleted: { garmentId: string; expectedDateUpdated: Date }[] = [];

  constructor(private readonly deleteError?: unknown) {}

  async create(garment: NewGarment): Promise<Garment> {
    void garment;
    throw new Error("Not implemented");
  }

  async update(input: UpdateGarment): Promise<Garment> {
    void input;
    throw new Error("Not implemented");
  }

  async delete(garmentId: string, expectedDateUpdated: Date): Promise<void> {
    this.deleted.push({ garmentId, expectedDateUpdated });
    if (this.deleteError !== undefined) throw this.deleteError;
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

function makeGarment(id: string, overrides: Partial<Garment> = {}): Garment {
  return {
    id,
    description: "Dress",
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    alterationType: "hem",
    price: Money.fromEuros(25),
    ...overrides,
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
    garments: [makeGarment("garment-1")],
    payments: [],
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { EditOrderDetails } from "@/application/useCases/EditOrderDetails";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("EditOrderDetails", () => {
  it("updates details for an editable order", async () => {
    const visibleVersion = new Date("2026-08-19T10:04:00.000Z");
    const order = makeOrder({ id: "order-1" });
    const repository = new FakeOrderRepository([order]);
    const useCase = new EditOrderDetails(repository);
    const dueDate = new Date("2026-08-24T10:00:00.000Z");

    const updated = await useCase.execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: visibleVersion, dueDate, notes: "Bring lace" });

    expect(repository.updatedDetails).toEqual([
      { orderId: "order-1", expectedDateUpdated: visibleVersion, dueDate, notes: "Bring lace" },
    ]);
    expect(updated.dueDate).toBe(dueDate);
    expect(updated.notes).toBe("Bring lace");
  });

  it("rejects non-editable orders without updating", async () => {
    const order = makeOrder({ status: OrderStatus.COLLECTED });
    const repository = new FakeOrderRepository([order]);
    const useCase = new EditOrderDetails(repository);

    await expect(useCase.execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate: new Date("2026-08-24T10:00:00.000Z") })).rejects.toBeInstanceOf(
      OrderNotEditableError,
    );
    expect(repository.updatedDetails).toEqual([]);
  });

  it("rejects missing due dates without updating", async () => {
    const order = makeOrder({});
    const repository = new FakeOrderRepository([order]);
    const useCase = new EditOrderDetails(repository);

    await expect(useCase.execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate: null })).rejects.toBeInstanceOf(MissingDueDateError);
    expect(repository.updatedDetails).toEqual([]);
  });

  it("throws OrderNotFoundError when the order does not exist", async () => {
    const repository = new FakeOrderRepository([]);
    const useCase = new EditOrderDetails(repository);

    await expect(useCase.execute({ orderNumber: "999999-9999", expectedDateUpdated: new Date("2026-08-19T10:05:00.000Z"), dueDate: new Date("2026-08-24T10:00:00.000Z") })).rejects.toBeInstanceOf(
      OrderNotFoundError,
    );
    expect(repository.updatedDetails).toEqual([]);
  });

  it("returns persisted details when an ambiguous update was saved", async () => {
    const order = makeOrder({ notes: "Old" });
    const dueDate = new Date("2026-08-24T10:00:00.000Z");
    const persisted = makeOrder({ dueDate, notes: "New", dateUpdated: new Date("2026-09-05T11:00:00.000Z") });
    const repository = new FakeOrderRepository([order], { reads: [order, persisted], updateDetailsError: new Error("timeout") });

    await expect(new EditOrderDetails(repository).execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate, notes: "New" })).resolves.toBe(persisted);
  });

  it("confirms an ambiguous details update was not saved when the prior version remains", async () => {
    const order = makeOrder({ notes: "Old" });
    const dueDate = new Date("2026-08-24T10:00:00.000Z");
    const repository = new FakeOrderRepository([order], { reads: [order, order], updateDetailsError: new Error("timeout") });

    await expect(new EditOrderDetails(repository).execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate, notes: "New" })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("reports a conflict when details reconciliation finds another version", async () => {
    const order = makeOrder({ notes: "Old" });
    const dueDate = new Date("2026-08-24T10:00:00.000Z");
    const incompatible = makeOrder({ notes: "Someone else", dateUpdated: new Date("2026-09-05T11:00:00.000Z") });
    const repository = new FakeOrderRepository([order], { reads: [order, incompatible], updateDetailsError: new Error("timeout") });

    await expect(new EditOrderDetails(repository).execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate, notes: "New" })).rejects.toBeInstanceOf(OrderConflictError);
  });

  it("wraps a failed details reconciliation as outcome unknown", async () => {
    const order = makeOrder({ notes: "Old" });
    const authError = Object.assign(new Error("expired"), { status: 401 });
    const dueDate = new Date("2026-08-24T10:00:00.000Z");
    const repository = new FakeOrderRepository([order], { reads: [order, authError], updateDetailsError: new Error("timeout") });

    const error = await new EditOrderDetails(repository).execute({ orderNumber: order.orderNumber.value, expectedDateUpdated: order.dateUpdated, dueDate, notes: "New" }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(MutationOutcomeUnknownError);
    expect(((error as Error).cause as AggregateError).errors).toContain(authError);
  });
});

class FakeOrderRepository implements OrderRepository {
  async getByIdempotencyKey(): Promise<Order | null> {
    return null;
  }

  readonly updatedDetails: UpdateOrderDetails[] = [];

  private readonly reads: unknown[];

  constructor(
    private readonly orders: readonly Order[],
    private readonly options: { reads?: unknown[]; updateDetailsError?: unknown } = {},
  ) {
    this.reads = [...(options.reads ?? [])];
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
    this.updatedDetails.push(input);
    if (this.options.updateDetailsError !== undefined) throw this.options.updateDetailsError;
    const order = this.orders.find((candidate) => candidate.id === input.orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    return { ...order, dueDate: input.dueDate, notes: input.notes };
  }

  async updateStatus(input: UpdateOrderStatus): Promise<Order> {
    void input;
    throw new Error("Not implemented");
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

function makeGarment(): Garment {
  return {
    id: "garment-1",
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
    description: "Dress",
    alterationType: "hem",
    price: Money.fromEuros(25),
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
    dateUpdated: new Date("2026-08-19T10:05:00.000Z"),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [makeGarment()],
    payments: [],
    ...overrides,
  };
}

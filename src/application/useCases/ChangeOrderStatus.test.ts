import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { ChangeOrderStatus } from "@/application/useCases/ChangeOrderStatus";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { InvalidStatusTransitionError } from "@/domain/errors/InvalidStatusTransitionError";
import { OrderConflictError } from "@/domain/errors/OrderConflictError";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("ChangeOrderStatus", () => {
  it("changes a received order to ready without collectedAt", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    const updated = await useCase.execute({ orderNumber: order.orderNumber.value, target: "ready", expectedStatus: "received", expectedDateUpdated: order.dateUpdated.toISOString() });

    expect(repository.updatedStatuses).toHaveLength(1);
    expect(repository.updatedStatuses[0]?.orderId).toBe("order-1");
    expect(repository.updatedStatuses[0]?.status).toBe(OrderStatus.READY);
    expect(repository.updatedStatuses[0]?.expectedStatus).toBe(OrderStatus.RECEIVED);
    expect(repository.updatedStatuses[0]?.expectedDateUpdated).toEqual(order.dateUpdated);
    expect(repository.updatedStatuses[0]?.collectedAt).toBeUndefined();
    expect(updated.status).toBe(OrderStatus.READY);
  });

  it("changes a ready order to collected with collectedAt", async () => {
    const order = makeOrder({ status: OrderStatus.READY });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    const before = Date.now();
    const updated = await useCase.execute({ orderNumber: order.orderNumber.value, target: "collected" });
    const after = Date.now();

    const collectedAt = repository.updatedStatuses[0]?.collectedAt;
    expect(repository.updatedStatuses[0]?.status).toBe(OrderStatus.COLLECTED);
    expect(collectedAt).toBeInstanceOf(Date);
    expect(collectedAt?.getTime()).toBeGreaterThanOrEqual(before);
    expect(collectedAt?.getTime()).toBeLessThanOrEqual(after);
    expect(updated.status).toBe(OrderStatus.COLLECTED);
  });

  it("changes a received order to cancelled", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    await useCase.execute({ orderNumber: order.orderNumber.value, target: "cancelled" });

    expect(repository.updatedStatuses[0]?.status).toBe(OrderStatus.CANCELLED);
    expect(repository.updatedStatuses[0]?.collectedAt).toBeUndefined();
  });

  it("changes a ready order to cancelled", async () => {
    const order = makeOrder({ status: OrderStatus.READY });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    await useCase.execute({ orderNumber: order.orderNumber.value, target: "cancelled" });

    expect(repository.updatedStatuses[0]?.status).toBe(OrderStatus.CANCELLED);
  });

  it("rejects terminal transitions without updating", async () => {
    const order = makeOrder({ status: OrderStatus.COLLECTED });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    await expect(useCase.execute({ orderNumber: order.orderNumber.value, target: "ready" })).rejects.toBeInstanceOf(InvalidStatusTransitionError);
    expect(repository.updatedStatuses).toEqual([]);
  });

  it("throws OrderNotFoundError when the order does not exist", async () => {
    const repository = new FakeOrderRepository([]);
    const useCase = new ChangeOrderStatus(repository);

    await expect(useCase.execute({ orderNumber: "999999-9999", target: "ready" })).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(repository.updatedStatuses).toEqual([]);
  });

  it("rejects unknown target statuses without updating", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const repository = new FakeOrderRepository([order]);
    const useCase = new ChangeOrderStatus(repository);

    await expect(useCase.execute({ orderNumber: order.orderNumber.value, target: "lost" })).rejects.toThrow("Invalid order status.");
    expect(repository.updatedStatuses).toEqual([]);
  });

  it("returns the persisted order when an ambiguous status update was saved", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const persisted = makeOrder({ status: OrderStatus.READY, dateUpdated: new Date("2026-09-05T11:00:00.000Z") });
    const repository = new FakeOrderRepository([order], { reads: [order, persisted], updateStatusError: new Error("timeout") });

    await expect(new ChangeOrderStatus(repository).execute({ orderNumber: order.orderNumber.value, target: "ready" })).resolves.toBe(persisted);
  });

  it("confirms a failed status update was not saved when the previous status remains", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const repository = new FakeOrderRepository([order], { reads: [order, order], updateStatusError: new Error("timeout") });

    await expect(new ChangeOrderStatus(repository).execute({ orderNumber: order.orderNumber.value, target: "ready" })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("reports a conflict when reconciliation finds an incompatible status", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const incompatible = makeOrder({ status: OrderStatus.CANCELLED });
    const repository = new FakeOrderRepository([order], { reads: [order, incompatible], updateStatusError: new Error("timeout") });

    await expect(new ChangeOrderStatus(repository).execute({ orderNumber: order.orderNumber.value, target: "ready" })).rejects.toBeInstanceOf(OrderConflictError);
  });

  it("keeps an authentication cause when status reconciliation also fails", async () => {
    const order = makeOrder({ status: OrderStatus.RECEIVED });
    const authError = Object.assign(new Error("expired"), { status: 401 });
    const repository = new FakeOrderRepository([order], { reads: [order, authError], updateStatusError: new Error("timeout") });

    const error = await new ChangeOrderStatus(repository).execute({ orderNumber: order.orderNumber.value, target: "ready" }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(MutationOutcomeUnknownError);
    expect((error as Error).cause).toBeInstanceOf(AggregateError);
    expect(((error as Error).cause as AggregateError).errors).toContain(authError);
  });
});

class FakeOrderRepository implements OrderRepository {
  async getByIdempotencyKey(): Promise<Order | null> {
    return null;
  }

  readonly updatedStatuses: UpdateOrderStatus[] = [];

  private readonly reads: unknown[];

  constructor(
    private readonly orders: readonly Order[],
    private readonly options: { reads?: unknown[]; updateStatusError?: unknown } = {},
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
    void input;
    throw new Error("Not implemented");
  }

  async updateStatus(input: UpdateOrderStatus): Promise<Order> {
    this.updatedStatuses.push(input);
    if (this.options.updateStatusError !== undefined) throw this.options.updateStatusError;
    const order = this.orders.find((candidate) => candidate.id === input.orderId);

    if (!order) {
      throw new OrderNotFoundError();
    }

    return { ...order, status: input.status, collectedAt: input.collectedAt };
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

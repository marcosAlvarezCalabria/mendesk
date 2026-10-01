import { describe, expect, it } from "vitest";

import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import type { OrderSequenceProvider } from "@/application/ports/OrderSequenceProvider";
import { CreateOrder } from "@/application/useCases/CreateOrder";
import type { Order } from "@/domain/entities/Order";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

const receivedDate = new Date(Date.UTC(2026, 7, 19));
const dueDate = new Date(Date.UTC(2026, 7, 21));

describe("CreateOrder", () => {
  it("creates a received order with a composed order number", async () => {
    const orders = new FakeOrderRepository();
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    const order = await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", clientId: "client-1", receivedDate, dueDate, notes: "Bring hanger" });

    expect(sequence.calls).toBe(1);
    expect(orders.created).toHaveLength(1);
    expect(orders.created[0]?.orderNumber.value).toBe("260819-0143");
    expect(orders.created[0]?.status.equals(OrderStatus.RECEIVED)).toBe(true);
    expect(order.orderNumber.value).toBe("260819-0143");
  });

  it.each(["", "   "])("rejects blank client id %j before I/O or sequence reservation", async clientId => {
    const orders = new FakeOrderRepository();
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", clientId, receivedDate, dueDate })).rejects.toThrow("Client is required");

    expect(sequence.calls).toBe(0);
    expect(orders.created).toHaveLength(0);
    expect(orders.reads).toBe(0);
  });

  it("rejects missing due dates before calling the sequence or repository", async () => {
    const orders = new FakeOrderRepository();
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", clientId: "client-1", receivedDate, dueDate: null })).rejects.toThrow(MissingDueDateError);
    expect(sequence.calls).toBe(0);
    expect(orders.created).toHaveLength(0);
  });

  it("calls the order sequence provider", async () => {
    const orders = new FakeOrderRepository();
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", clientId: "client-1", receivedDate, dueDate });

    expect(sequence.calls).toBe(1);
  });

  it("reconciles a retry even when its request timestamp was generated again", async () => {
    const existing = makeOrder({ receivedDate });
    const orders = new FakeOrderRepository(existing);
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    const result = await useCase.execute({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      clientId: "client-1",
      receivedDate: new Date("2026-08-19T00:00:05.000Z"),
      dueDate,
    });

    expect(result).toBe(existing);
    expect(sequence.calls).toBe(0);
    expect(orders.created).toEqual([]);
  });

  it("reconciles an empty notes retry when Directus maps the stored value to an empty string", async () => {
    const existing = makeOrder({ notes: "" });
    const orders = new FakeOrderRepository(existing);
    const sequence = new FakeOrderSequenceProvider(143);
    const useCase = new CreateOrder(orders, sequence);

    const result = await useCase.execute({
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440000",
      clientId: "client-1",
      receivedDate,
      dueDate,
      notes: undefined,
    });

    expect(result).toBe(existing);
    expect(sequence.calls).toBe(0);
    expect(orders.created).toEqual([]);
  });
});

class FakeOrderRepository implements OrderRepository {
  constructor(private readonly existing: Order | null = null) {}

  reads = 0;
  async getByIdempotencyKey(): Promise<Order | null> {
    this.reads += 1;
    return this.existing;
  }

  readonly created: NewOrder[] = [];

  async getByOrderNumber(): Promise<Order | null> {
    return null;
  }

  async create(order: NewOrder): Promise<Order> {
    this.created.push(order);

    return {
      id: `order-${this.created.length}`,
      orderNumber: order.orderNumber,
      client: {
        id: order.clientId,
        name: "Mary Kelly",
        phone: PhoneNumber.fromRaw("085 200 9225"),
        gdprConsent: true,
      },
      status: order.status,
      receivedDate: order.receivedDate,
      dateUpdated: order.receivedDate,
      dueDate: order.dueDate,
      notes: order.notes,
      garments: [],
      payments: [],
    } as Order;
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

class FakeOrderSequenceProvider implements OrderSequenceProvider {
  calls = 0;

  constructor(private readonly value: number) {}

  async next(): Promise<number> {
    this.calls += 1;

    return this.value;
  }
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-existing",
    orderNumber: { value: "260819-0142" } as Order["orderNumber"],
    client: {
      id: "client-1",
      name: "Mary Kelly",
      phone: PhoneNumber.fromRaw("085 200 9225"),
      gdprConsent: true,
    },
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: receivedDate,
    dueDate,
    garments: [],
    payments: [],
    ...overrides,
  };
}

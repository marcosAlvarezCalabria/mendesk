import { describe, expect, it } from "vitest";

import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { GetOrder } from "@/application/useCases/GetOrder";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("GetOrder", () => {
  it("returns an order by order number", async () => {
    const order = makeOrder("260819-0142");
    const useCase = new GetOrder(new FakeOrderRepository([order]));

    await expect(useCase.execute("260819-0142")).resolves.toBe(order);
  });

  it("throws OrderNotFoundError when the order does not exist", async () => {
    const useCase = new GetOrder(new FakeOrderRepository([]));

    await expect(useCase.execute("999999-9999")).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("throws OrderNotFoundError for blank order numbers without calling the repository", async () => {
    const repository = new FakeOrderRepository([]);
    const useCase = new GetOrder(repository);

    await expect(useCase.execute("   ")).rejects.toBeInstanceOf(OrderNotFoundError);
    expect(repository.getByOrderNumberCalls).toBe(0);
  });
});

class FakeOrderRepository implements OrderRepository {
  async getByIdempotencyKey(): Promise<Order | null> {
    return null;
  }

  getByOrderNumberCalls = 0;

  constructor(private readonly orders: readonly Order[]) {}

  async getByOrderNumber(orderNumber: string): Promise<Order | null> {
    this.getByOrderNumberCalls += 1;

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

function makeOrder(orderNumber: string): Order {
  return {
    id: "order-1",
    orderNumber: orderNumber === "260819-0142" ? OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142) : OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 1),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate: new Date("2026-08-19T10:00:00.000Z"),
    dateUpdated: new Date('2026-08-19T10:05:00.000Z'),
    dueDate: new Date("2026-08-21T10:00:00.000Z"),
    garments: [makeGarment()],
    payments: [],
  };
}

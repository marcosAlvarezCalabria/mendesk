import { describe, expect, it } from "vitest";

import type { NewOrder, OrderRepository, UpdateOrderDetails, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import { PrintGarmentTickets } from "@/application/useCases/PrintGarmentTickets";
import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("PrintGarmentTickets", () => {
  it("builds one economic ticket per garment", async () => {
    const order = makeOrder({ garments: [makeGarment({ id: "garment-1", description: "Blue dress", alterationType: "hem" }), makeGarment({ id: "garment-2", description: "Wool coat", alterationType: "sleeves" })] });

    const tickets = await new PrintGarmentTickets(new FakeOrderRepository(order), "https://demo.mendesk.example").execute(order.orderNumber.value);

    expect(tickets).toHaveLength(2);
    expect(tickets[0]).toMatchObject({ orderNumber: "260819-0142", garmentDescription: "Blue dress", depositPaid: "10.00", outstanding: "40.00" });
    expect(tickets[1]).toMatchObject({ orderNumber: "260819-0142", garmentDescription: "Wool coat", depositPaid: "10.00", outstanding: "40.00" });
  });

  it("always uses the canonical panel order link", async () => {
    const [ticket] = await new PrintGarmentTickets(new FakeOrderRepository(makeOrder()), "https://demo.mendesk.example").execute("260819-0142");
    expect(ticket?.deepLinkUrl).toBe("https://demo.mendesk.example/orders/260819-0142");
  });

  it("throws OrderNotFoundError when the order number does not exist", async () => {
    await expect(new PrintGarmentTickets(new FakeOrderRepository(null), "https://demo.mendesk.example").execute("260819-9999")).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

class FakeOrderRepository implements OrderRepository {
  constructor(private readonly order: Order | null) {}
  async getByIdempotencyKey(): Promise<Order | null> { return null; }
  async getByOrderNumber(orderNumber: string): Promise<Order | null> { return this.order?.orderNumber.value === orderNumber ? this.order : null; }
  async create(order: NewOrder): Promise<Order> { void order; throw new Error("Not implemented"); }
  async updateDetails(input: UpdateOrderDetails): Promise<Order> { void input; throw new Error("Not implemented"); }
  async updateStatus(input: UpdateOrderStatus): Promise<Order> { void input; throw new Error("Not implemented"); }
}

function makeClient(): Client {
  return { id: "client-1", name: "Mary Kelly", phone: PhoneNumber.fromRaw("085 200 9225"), gdprConsent: true };
}

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return { id: "garment-1", description: "Blue dress", alterationType: "hem", measurements: "Hem 4cm", price: Money.fromEuros(25), ...overrides, dateUpdated: new Date("2026-09-05T10:00:00.000Z") };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date(Date.UTC(2026, 7, 19));
  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: new Date("2026-08-19T10:05:00.000Z"),
    dueDate: new Date("2026-08-25T00:00:00.000Z"),
    garments: [makeGarment()],
    payments: [{ id: "payment-1", type: "deposit", amount: Money.fromEuros(10), method: "cash", createdAt: receivedDate }],
    ...overrides,
  };
}

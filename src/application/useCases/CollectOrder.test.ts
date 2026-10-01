import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import type { OrderRepository, UpdateOrderStatus } from "@/application/ports/OrderRepository";
import type { NewPayment, PaymentRepository } from "@/application/ports/PaymentRepository";
import { CollectOrder } from "@/application/useCases/CollectOrder";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("CollectOrder", () => {
  it("records the exact final payment before collecting a Ready order", async () => {
    const order = makeOrder();
    const orders = new FakeOrders(order);
    const payments = new FakePayments();
    const result = await new CollectOrder(orders, payments).execute(input());
    expect(payments.created).toHaveLength(1);
    expect(payments.created[0]).toMatchObject({ orderId: "order-1", type: "final", method: "cash" });
    expect(payments.created[0]?.amount.toString()).toBe("20.00");
    expect(orders.updated).toHaveLength(1);
    expect(result.paymentRecorded).toBe(true);
    expect(result.order.status.equals(OrderStatus.COLLECTED)).toBe(true);
  });

  it("collects without creating a payment when the balance is already zero", async () => {
    const paid = makeOrder({ payments: [payment("deposit", 20)] });
    const payments = new FakePayments();
    const result = await new CollectOrder(new FakeOrders(paid), payments).execute(input({ amountEuros: 0 }));
    expect(payments.created).toHaveLength(0);
    expect(result.paymentRecorded).toBe(false);
  });

  it("rejects a final payment that differs from the current outstanding balance", async () => {
    const orders = new FakeOrders(makeOrder());
    await expect(new CollectOrder(orders, new FakePayments()).execute(input({ amountEuros: 19 }))).rejects.toThrow("Final payment must equal the outstanding balance.");
    expect(orders.updated).toHaveLength(0);
  });

  it("does not attempt Collected when saving the payment fails", async () => {
    const orders = new FakeOrders(makeOrder());
    await expect(new CollectOrder(orders, new FakePayments(new Error("payment failed"))).execute(input())).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
    expect(orders.updated).toHaveLength(0);
  });

  it("reuses a compatible idempotent payment and retries only Collected", async () => {
    const existing = payment("final", 20);
    const orders = new FakeOrders(makeOrder({ payments: [existing] }));
    const payments = new FakePayments(undefined, existing);
    const result = await new CollectOrder(orders, payments).execute(input());
    expect(payments.created).toHaveLength(0);
    expect(orders.updated).toHaveLength(1);
    expect(result.paymentRecorded).toBe(true);
  });

  it("exposes a confirmed partial result when payment saved but Collected did not", async () => {
    const orders = new FakeOrders(makeOrder(), new MutationConfirmedNotSavedError());
    await expect(new CollectOrder(orders, new FakePayments()).execute(input())).rejects.toMatchObject({ paymentRecorded: true });
  });
});

class FakeOrders implements OrderRepository {
  readonly updated: UpdateOrderStatus[] = [];
  constructor(private readonly order: Order, private readonly updateError?: unknown) {}
  async getByOrderNumber(): Promise<Order | null> { return this.order; }
  async getByIdempotencyKey(): Promise<Order | null> { return null; }
  async create(): Promise<Order> { throw new Error("Not implemented"); }
  async updateDetails(): Promise<Order> { throw new Error("Not implemented"); }
  async updateStatus(change: UpdateOrderStatus): Promise<Order> {
    this.updated.push(change);
    if (this.updateError) throw this.updateError;
    return { ...this.order, status: change.status, collectedAt: change.collectedAt };
  }
}

class FakePayments implements PaymentRepository {
  readonly created: NewPayment[] = [];
  constructor(private readonly createError?: unknown, private readonly existing: Payment | null = null) {}
  async getByIdempotencyKey(): Promise<Payment | null> { return this.existing; }
  async create(value: NewPayment): Promise<Payment> {
    this.created.push(value);
    if (this.createError) throw this.createError;
    return payment(value.type, value.amount.cents / 100, value.method);
  }
  async delete(): Promise<void> { throw new Error("Not implemented"); }
}

function input(overrides: Partial<Parameters<CollectOrder["execute"]>[0]> = {}) {
  return { orderNumber: "260910-0020", expectedDateUpdated: "2026-09-10T09:00:00.000Z", idempotencyKey: "550e8400-e29b-41d4-a716-446655440020", amountEuros: 20, method: "cash", ...overrides };
}

function payment(type: Payment["type"], euros: number, method: Payment["method"] = "cash"): Payment {
  return { id: "payment-final", orderId: "order-1", type, amount: Money.fromEuros(euros), method, createdAt: new Date("2026-09-10T10:00:00.000Z") };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-09-10T09:00:00.000Z");
  return { id: "order-1", orderNumber: OrderNumber.fromString("260910-0020"), client: { id: "client-1", name: "Mary", phone: null, gdprConsent: true }, status: OrderStatus.READY, receivedDate, dateUpdated: receivedDate, dueDate: new Date("2026-09-12T09:00:00.000Z"), garments: [{ id: "garment-1", orderId: "order-1", description: "Dress", alterationType: "hem", price: Money.fromEuros(20), dateUpdated: receivedDate }], payments: [], ...overrides };
}

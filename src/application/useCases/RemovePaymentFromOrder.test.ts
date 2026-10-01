import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { PaymentRepository } from "@/application/ports/PaymentRepository";
import { RemovePaymentFromOrder } from "@/application/useCases/RemovePaymentFromOrder";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { PaymentNotFoundError } from "@/domain/errors/PaymentNotFoundError";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";

describe("RemovePaymentFromOrder", () => {
  it("removes a payment that belongs to an editable order", async () => {
    const order = makeOrder();
    const payments = new RecordingPaymentRepository();

    await new RemovePaymentFromOrder(new FakeOrderRepository([order]), payments).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-1" });

    expect(payments.deleted).toEqual(["payment-1"]);
  });

  it("rejects a payment that does not belong to the order", async () => {
    const order = makeOrder();
    const payments = new RecordingPaymentRepository();

    await expect(new RemovePaymentFromOrder(new FakeOrderRepository([order]), payments).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-other" })).rejects.toBeInstanceOf(PaymentNotFoundError);
    expect(payments.deleted).toEqual([]);
  });

  it.each([OrderStatus.COLLECTED, OrderStatus.CANCELLED])("rejects removal from a terminal %s order", async (status) => {
    const order = makeOrder({ status });
    const payments = new RecordingPaymentRepository();

    await expect(new RemovePaymentFromOrder(new FakeOrderRepository([order]), payments).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-1" })).rejects.toBeInstanceOf(OrderNotEditableError);
    expect(payments.deleted).toEqual([]);
  });

  it("accepts an ambiguous delete when the following read confirms the payment is absent", async () => {
    const order = makeOrder();
    const withoutPayment = makeOrder({ payments: [] });
    const orders = new FakeOrderRepository([order, withoutPayment]);

    await expect(new RemovePaymentFromOrder(orders, new RecordingPaymentRepository(new Error("timeout"))).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-1" })).resolves.toBeUndefined();
  });

  it("distinguishes confirmed-not-saved from an unknown reconciliation result", async () => {
    const order = makeOrder();
    await expect(new RemovePaymentFromOrder(new FakeOrderRepository([order, order]), new RecordingPaymentRepository(new Error("timeout"))).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-1" })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
    await expect(new RemovePaymentFromOrder(new FakeOrderRepository([order, new Error("read failed")]), new RecordingPaymentRepository(new Error("timeout"))).execute({ orderNumber: order.orderNumber.value, paymentId: "payment-1" })).rejects.toBeInstanceOf(MutationOutcomeUnknownError);
  });
});

class RecordingPaymentRepository implements PaymentRepository {
  readonly deleted: string[] = [];
  constructor(private readonly deleteError?: unknown) {}
  async getByIdempotencyKey(): Promise<Payment | null> { return null; }
  async create(): Promise<Payment> { throw new Error("Not implemented"); }
  async delete(paymentId: string): Promise<void> {
    this.deleted.push(paymentId);
    if (this.deleteError) throw this.deleteError;
  }
}

class FakeOrderRepository implements OrderRepository {
  private readonly reads: unknown[];
  constructor(reads: unknown[]) { this.reads = [...reads]; }
  async getByOrderNumber(): Promise<Order | null> {
    const result = this.reads.shift();
    if (result instanceof Error) throw result;
    return (result as Order | null | undefined) ?? null;
  }
  async getByIdempotencyKey(): Promise<Order | null> { return null; }
  async create(): Promise<Order> { throw new Error("Not implemented"); }
  async updateDetails(): Promise<Order> { throw new Error("Not implemented"); }
  async updateStatus(): Promise<Order> { throw new Error("Not implemented"); }
}

function payment(): Payment {
  return { id: "payment-1", orderId: "order-1", type: "deposit", amount: Money.fromEuros(10), method: "cash", createdAt: new Date("2026-09-10T10:00:00.000Z") };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  const receivedDate = new Date("2026-09-10T09:00:00.000Z");
  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(receivedDate, 20),
    client: { id: "client-1", name: "Mary", phone: null, gdprConsent: true },
    status: OrderStatus.RECEIVED,
    receivedDate,
    dateUpdated: receivedDate,
    dueDate: new Date("2026-09-12T09:00:00.000Z"),
    garments: [],
    payments: [payment()],
    ...overrides,
  };
}

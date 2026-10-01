import { describe, expect, it } from "vitest";

import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { assertDueDate, assertEditable, assertPaymentAllowed, isEditable, isOverdue, outstandingBalance } from "@/domain/orders/orderRules";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("orderRules", () => {
  it("calculates outstanding balance from garment prices minus payments", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(25) }), makeGarment({ id: "garment-2", price: Money.fromEuros(30) })],
      payments: [makePayment({ amount: Money.fromEuros(20) })],
    });

    expect(outstandingBalance(order).toString()).toBe("35.00");
  });

  it("returns the full total when there are no payments", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(25) }), makeGarment({ id: "garment-2", price: Money.fromEuros(30) })],
      payments: [],
    });

    expect(outstandingBalance(order).toString()).toBe("55.00");
  });

  it("returns zero when payments equal prices", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(55) })],
      payments: [makePayment({ amount: Money.fromEuros(55) })],
    });

    expect(outstandingBalance(order).isZero()).toBe(true);
  });

  it("allows a positive payment up to the outstanding balance", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(55) })],
      payments: [makePayment({ amount: Money.fromEuros(20) })],
    });

    expect(() => assertPaymentAllowed(order, Money.fromEuros(0.01))).not.toThrow();
    expect(() => assertPaymentAllowed(order, Money.fromEuros(35))).not.toThrow();
  });

  it("rejects zero and payments above the outstanding balance", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(55) })],
      payments: [makePayment({ amount: Money.fromEuros(20) })],
    });

    expect(() => assertPaymentAllowed(order, Money.zero())).toThrow("Payment amount must be greater than zero.");
    expect(() => assertPaymentAllowed(order, Money.fromEuros(35.01))).toThrow("Payment amount exceeds the outstanding balance.");
  });

  it("rejects payments for collected and cancelled orders", () => {
    expect(() => assertPaymentAllowed(makeOrder({ status: OrderStatus.COLLECTED }), Money.fromEuros(1))).toThrow(OrderNotEditableError);
    expect(() => assertPaymentAllowed(makeOrder({ status: OrderStatus.CANCELLED }), Money.fromEuros(1))).toThrow(OrderNotEditableError);
  });

  it("clamps outstanding balance to zero when payments exceed prices", () => {
    const order = makeOrder({
      garments: [makeGarment({ price: Money.fromEuros(55) })],
      payments: [makePayment({ amount: Money.fromEuros(60) })],
    });

    expect(outstandingBalance(order).isZero()).toBe(true);
  });

  it("marks received orders overdue only when due date is strictly before today", () => {
    const today = new Date("2026-08-20T00:00:00.000Z");
    const order = makeOrder({ dueDate: new Date("2026-08-19T00:00:00.000Z"), status: OrderStatus.RECEIVED });

    expect(isOverdue(order, today)).toBe(true);
  });

  it("does not mark orders overdue when due date equals today", () => {
    const today = new Date("2026-08-20T00:00:00.000Z");
    const order = makeOrder({ dueDate: today, status: OrderStatus.RECEIVED });

    expect(isOverdue(order, today)).toBe(false);
  });

  it("does not mark ready orders overdue after their due date", () => {
    const today = new Date("2026-08-20T00:00:00.000Z");
    const yesterday = new Date("2026-08-19T00:00:00.000Z");

    expect(isOverdue(makeOrder({ dueDate: yesterday, status: OrderStatus.READY }), today)).toBe(false);
  });

  it("does not mark terminal orders overdue", () => {
    const today = new Date("2026-08-20T00:00:00.000Z");
    const yesterday = new Date("2026-08-19T00:00:00.000Z");

    expect(isOverdue(makeOrder({ dueDate: yesterday, status: OrderStatus.COLLECTED }), today)).toBe(false);
    expect(isOverdue(makeOrder({ dueDate: yesterday, status: OrderStatus.CANCELLED }), today)).toBe(false);
  });

  it("marks received and ready orders editable, and terminal orders not editable", () => {
    expect(isEditable(makeOrder({ status: OrderStatus.RECEIVED }))).toBe(true);
    expect(isEditable(makeOrder({ status: OrderStatus.READY }))).toBe(true);
    expect(isEditable(makeOrder({ status: OrderStatus.COLLECTED }))).toBe(false);
    expect(isEditable(makeOrder({ status: OrderStatus.CANCELLED }))).toBe(false);
  });

  it("throws when asserting editable on collected orders", () => {
    expect(() => assertEditable(makeOrder({ status: OrderStatus.COLLECTED }))).toThrow(OrderNotEditableError);
  });

  it("does not throw when asserting editable on received orders", () => {
    expect(() => assertEditable(makeOrder({ status: OrderStatus.RECEIVED }))).not.toThrow();
  });

  it("returns a valid due date", () => {
    const dueDate = new Date("2026-08-21T00:00:00.000Z");

    expect(assertDueDate(dueDate)).toBe(dueDate);
  });

  it("throws for missing or invalid due dates", () => {
    expect(() => assertDueDate(null)).toThrow(MissingDueDateError);
    expect(() => assertDueDate(undefined)).toThrow(MissingDueDateError);
    expect(() => assertDueDate(new Date("x"))).toThrow(MissingDueDateError);
  });
});

function makeClient(): Client {
  return {
    id: "client-1",
    name: "Ada Lovelace",
    phone: PhoneNumber.fromRaw("085 200 9225"),
    gdprConsent: true,
  };
}

function makeGarment(overrides: Partial<Garment> = {}): Garment {
  return {
    id: "garment-1",
    description: "Blue dress",
    alterationType: "hem",
    price: Money.fromEuros(25),
    ...overrides,
    dateUpdated: new Date("2026-09-05T10:00:00.000Z"),
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    type: "deposit",
    amount: Money.fromEuros(20),
    method: "cash",
    createdAt: new Date("2026-08-19T10:00:00.000Z"),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "order-1",
    orderNumber: OrderNumber.compose(new Date(Date.UTC(2026, 7, 19)), 142),
    client: makeClient(),
    status: OrderStatus.RECEIVED,
    receivedDate: new Date("2026-08-19T09:00:00.000Z"),
    dateUpdated: new Date("2026-08-19T10:05:00.000Z"),
    dueDate: new Date("2026-08-21T00:00:00.000Z"),
    garments: [makeGarment()],
    payments: [makePayment()],
    ...overrides,
  };
}

import { describe, expect, it } from "vitest";

import type { NewPayment, PaymentRepository } from "@/application/ports/PaymentRepository";
import { RecordPayment } from "@/application/useCases/RecordPayment";
import type { Payment } from "@/domain/entities/Payment";
import { InvalidMoneyError } from "@/domain/errors/InvalidMoneyError";

describe("RecordPayment", () => {
  it("records a valid deposit payment in cash", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    const payment = await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "deposit", amountEuros: 20, method: "cash" });

    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]?.orderId).toBe("order-1");
    expect(repository.created[0]?.type).toBe("deposit");
    expect(repository.created[0]?.amount.toString()).toBe("20.00");
    expect(repository.created[0]?.method).toBe("cash");
    expect(payment.type).toBe("deposit");
    expect(payment.amount.toString()).toBe("20.00");
    expect(payment.method).toBe("cash");
  });

  it("records a valid final payment by card", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    const payment = await useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "final", amountEuros: 45, method: "card" });

    expect(repository.created[0]?.type).toBe("final");
    expect(repository.created[0]?.method).toBe("card");
    expect(payment.type).toBe("final");
    expect(payment.method).toBe("card");
  });

  it("rejects zero payments without calling the repository", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "deposit", amountEuros: 0, method: "cash" })).rejects.toThrow(
      "Payment amount must be greater than zero.",
    );
    expect(repository.created).toEqual([]);
  });

  it("rejects negative payments without calling the repository", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "deposit", amountEuros: -1, method: "cash" })).rejects.toBeInstanceOf(
      InvalidMoneyError,
    );
    expect(repository.created).toEqual([]);
  });

  it("rejects unknown payment types without calling the repository", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "gift", amountEuros: 20, method: "cash" })).rejects.toThrow(
      "Invalid payment type.",
    );
    expect(repository.created).toEqual([]);
  });

  it("rejects unknown payment methods without calling the repository", async () => {
    const repository = new FakePaymentRepository();
    const useCase = new RecordPayment(repository);

    await expect(useCase.execute({ idempotencyKey: "550e8400-e29b-41d4-a716-446655440000", orderId: "order-1", type: "deposit", amountEuros: 20, method: "bitcoin" })).rejects.toThrow(
      "Invalid payment method.",
    );
    expect(repository.created).toEqual([]);
  });
});

class FakePaymentRepository implements PaymentRepository {
  readonly created: NewPayment[] = [];

  async getByIdempotencyKey(): Promise<Payment | null> {
    return null;
  }

  async create(payment: NewPayment): Promise<Payment> {
    this.created.push(payment);

    return {
      id: `payment-${this.created.length}`,
      orderId: payment.orderId,
      type: payment.type,
      amount: payment.amount,
      method: payment.method,
      createdAt: new Date("2026-08-22T10:00:00.000Z"),
    };
  }

  async delete(): Promise<void> {
    throw new Error("Not implemented");
  }
}

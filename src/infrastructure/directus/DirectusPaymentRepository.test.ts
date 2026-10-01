import { describe, expect, it } from "vitest";

import type { NewPayment } from "@/application/ports/PaymentRepository";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import type { DirectusPaymentCreatePayload, DirectusPaymentGateway } from "@/infrastructure/directus/DirectusPaymentGateway";
import { DirectusPaymentRepository } from "@/infrastructure/directus/DirectusPaymentRepository";
import type { DirectusPaymentRecord } from "@/infrastructure/directus/records";

describe("DirectusPaymentRepository", () => {
const idempotencyKey = IdempotencyKey.fromString("550e8400-e29b-41d4-a716-446655440000");

  it("creates a deposit payment through the Directus gateway and returns the record id and date", async () => {
    const gateway = new FakeDirectusPaymentGateway({
      id: "payment-1",
      type: "deposit",
      amount: 20,
      method: "cash",
      date_created: "2026-08-22T10:15:00.000Z",
    });
    const repository = new DirectusPaymentRepository(gateway);
    const input: NewPayment = { idempotencyKey, orderId: "order-1", type: "deposit", amount: Money.fromEuros(20), method: "cash" };

    const payment = await repository.create(input);

    expect(gateway.lastPayload).toEqual({ idempotency_key: idempotencyKey.value, order: "order-1", type: "deposit", amount: 20, method: "cash" });
    expect(payment.id).toBe("payment-1");
    expect(payment.type).toBe("deposit");
    expect(payment.amount.toEuros()).toBe(20);
    expect(payment.method).toBe("cash");
    expect(payment.createdAt).toEqual(new Date("2026-08-22T10:15:00.000Z"));
  });

  it("creates a final card payment with the expected payload", async () => {
    const gateway = new FakeDirectusPaymentGateway({
      id: "payment-2",
      type: "final",
      amount: 45,
      method: "card",
      date_created: "2026-08-22T11:00:00.000Z",
    });
    const repository = new DirectusPaymentRepository(gateway);

    await repository.create({ idempotencyKey, orderId: "order-2", type: "final", amount: Money.fromEuros(45), method: "card" });

    expect(gateway.lastPayload).toEqual({ idempotency_key: idempotencyKey.value, order: "order-2", type: "final", amount: 45, method: "card" });
  });

  it("rejects an empty Directus response instead of inventing a saved payment", async () => {
    const gateway = new FakeDirectusPaymentGateway(null);
    const repository = new DirectusPaymentRepository(gateway);

    await expect(repository.create({ idempotencyKey, orderId: "order-3", type: "deposit", amount: Money.fromEuros(15), method: "cash" })).rejects.toThrow("Created Directus payment did not return a record");
  });

  it("deletes the exact payment through the Directus gateway", async () => {
    const gateway = new FakeDirectusPaymentGateway(null);
    const repository = new DirectusPaymentRepository(gateway);

    await repository.delete("payment-2");

    expect(gateway.deleted).toEqual(["payment-2"]);
  });
});

class FakeDirectusPaymentGateway implements DirectusPaymentGateway {
  readonly deleted: string[] = [];
  async getPaymentByIdempotencyKey(): Promise<DirectusPaymentRecord | null> {
    return null;
  }
  lastPayload: DirectusPaymentCreatePayload | null = null;

  constructor(private readonly record: DirectusPaymentRecord | null) {}

  async createPayment(payload: DirectusPaymentCreatePayload): Promise<DirectusPaymentRecord | null> {
    this.lastPayload = payload;
    return this.record;
  }

  async deletePayment(paymentId: string): Promise<void> {
    this.deleted.push(paymentId);
  }
}

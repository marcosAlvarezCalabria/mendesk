import { describe, expect, it } from "vitest";
import type { Order } from "@/domain/entities/Order";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { Money } from "@/domain/values/Money";
import { toOrderSnapshot } from "./OrderSnapshot";

const date = new Date("2026-09-07T10:00:00.000Z");
const order: Order = {
  id: "order-id", orderNumber: OrderNumber.fromString("260907-0142"),
  client: { id: "client-id", name: "Example", phone: null, gdprConsent: true },
  status: OrderStatus.RECEIVED, receivedDate: date, dateUpdated: date, dueDate: date,
  garments: [{ id: "garment-id", description: "Hem", alterationType: "hem", dateUpdated: date, price: Money.fromCents(1234) }],
  payments: [{ id: "payment-id", type: "deposit", amount: Money.fromCents(234), method: "cash", createdAt: date }],
};

describe("OrderSnapshot", () => {
  it("serializes the complete persisted aggregate without value objects", () => {
    const snapshot = toOrderSnapshot(order);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
    expect(snapshot).toEqual({
      id: "order-id", orderNumber: "260907-0142", client: { id: "client-id", name: "Example", phone: null, gdprConsent: true, notes: null },
      status: "received", receivedDate: date.toISOString(), dateUpdated: date.toISOString(), dueDate: date.toISOString(), collectedAt: null, notes: null,
      garments: [{ id: "garment-id", description: "Hem", alterationType: "hem", dateUpdated: date.toISOString(), measurements: null, photoId: null, priceCents: 1234 }],
      payments: [{ id: "payment-id", type: "deposit", amountCents: 234, method: "cash", createdAt: date.toISOString() }],
    });
  });
  it("uses an explicit allowlist rather than leaking extra source properties", () => {
    const snapshot = toOrderSnapshot({ ...order, token: "not-a-real-token", idempotencyKey: "private" } as Order);
    expect(snapshot).not.toHaveProperty("token");
    expect(snapshot).not.toHaveProperty("idempotencyKey");
  });
  it("preserves optional persisted fields and zero amounts", () => {
    const snapshot = toOrderSnapshot({ ...order, notes: "Note", collectedAt: date, garments: [{ ...order.garments[0]!, price: Money.zero(), measurements: "10", photoId: "photo-id" }] });
    expect(snapshot.notes).toBe("Note");
    expect(snapshot.collectedAt).toBe(date.toISOString());
    expect(snapshot.garments[0]).toMatchObject({ priceCents: 0, measurements: "10", photoId: "photo-id" });
  });
});

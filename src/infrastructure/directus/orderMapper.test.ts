import { describe, expect, it } from "vitest";

import { OrderStatus } from "@/domain/values/OrderStatus";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { mapOrder } from "@/infrastructure/directus/orderMapper";
import type {
  DirectusGarmentRecord,
  DirectusOrderRecord,
  DirectusPaymentRecord,
} from "@/infrastructure/directus/records";

describe("mapOrder", () => {
  it("uses creation as the initial order and garment version before the first update", () => {
    const created = "2026-09-08T10:00:00.000Z";
    const record = makeRecord();
    Object.assign(record, { date_updated: null, date_created: created });
    Object.assign(record.garments![0], { date_updated: null, date_created: created });
    const order = mapOrder(record);
    expect(order.dateUpdated.toISOString()).toBe(created);
    expect(order.garments[0].dateUpdated.toISOString()).toBe(created);
  });

  it.each([undefined, null, "", "invalid"])("rejects an unusable creation date %s when update is null", created => {
    const record = makeRecord();
    Object.assign(record, { date_updated: null, date_created: created });
    expect(() => mapOrder(record)).toThrow(DirectusMappingError);
  });

  it("never substitutes creation for a malformed update date", () => {
    const record = makeRecord();
    Object.assign(record, { date_updated: "invalid", date_created: "2026-09-08T10:00:00.000Z" });
    expect(() => mapOrder(record)).toThrow(DirectusMappingError);
  });
  it("maps a complete Directus order record to the domain aggregate", () => {
    const order = mapOrder(makeRecord());

    expect(order.orderNumber.value).toBe("260819-0142");
    expect(order.client.name).toBe("Mary");
    expect(order.client.phone?.value).toBe("353852009225");
    expect(order.client.gdprConsent).toBe(true);
    expect(order.status.equals(OrderStatus.RECEIVED)).toBe(true);
    expect(order.garments).toHaveLength(2);
    expect(order.payments).toHaveLength(1);
    expect(order.payments[0]?.type).toBe("deposit");
    expect(order.payments[0]?.method).toBe("cash");
    expect(order.payments[0]?.amount.toEuros()).toBe(20);
  });

  it("maps money values from strings and numbers", () => {
    const order = mapOrder(
      makeRecord({
        garments: [makeGarment({ id: "garment-1", price: "30.50" }), makeGarment({ id: "garment-2", price: 15 })],
      }),
    );

    expect(order.garments[0]?.price.toEuros()).toBe(30.5);
    expect(order.garments[1]?.price.toEuros()).toBe(15);
  });

  it("falls back unknown and null alteration types to other", () => {
    const order = mapOrder(
      makeRecord({
        garments: [makeGarment({ id: "garment-1", alteration_type: "zzz" }), makeGarment({ id: "garment-2", alteration_type: null })],
      }),
    );

    expect(order.garments[0]?.alterationType).toBe("other");
    expect(order.garments[1]?.alterationType).toBe("other");
  });

  it("normalizes garment photo ids from string, object, null, and absent values", () => {
    const stringPhotoOrder = mapOrder(makeRecord({ garments: [makeGarment({ photo: "file-string" })] }));
    const objectPhotoOrder = mapOrder(makeRecord({ garments: [makeGarment({ photo: { id: "file-object" } })] }));
    const nullPhotoOrder = mapOrder(makeRecord({ garments: [makeGarment({ photo: null })] }));
    const absentPhotoOrder = mapOrder(makeRecord({ garments: [makeGarment({ photo: undefined })] }));

    expect(stringPhotoOrder.garments[0]?.photoId).toBe("file-string");
    expect(objectPhotoOrder.garments[0]?.photoId).toBe("file-object");
    expect(nullPhotoOrder.garments[0]?.photoId).toBeUndefined();
    expect(absentPhotoOrder.garments[0]?.photoId).toBeUndefined();
  });

  it("throws DirectusMappingError for unknown order statuses", () => {
    expect(() => mapOrder(makeRecord({ status: "shipped" }))).toThrow(DirectusMappingError);
  });

  it("throws DirectusMappingError for invalid payment method or type", () => {
    expect(() => mapOrder(makeRecord({ payments: [makePayment({ method: "paypal" })] }))).toThrow(DirectusMappingError);
    expect(() => mapOrder(makeRecord({ payments: [makePayment({ type: "refund" })] }))).toThrow(DirectusMappingError);
  });

  it("maps nullable optional fields to undefined and absent relations to empty arrays", () => {
    const order = mapOrder(
      makeRecord({
        collected_at: null,
        notes: null,
        garments: undefined,
        payments: undefined,
      }),
    );
    const garmentOrder = mapOrder(
      makeRecord({
        garments: [makeGarment({ measurements: null, photo: null })],
      }),
    );

    expect(order.collectedAt).toBeUndefined();
    expect(order.notes).toBeUndefined();
    expect(order.garments).toEqual([]);
    expect(order.payments).toEqual([]);
    expect(garmentOrder.garments[0]?.measurements).toBeUndefined();
    expect(garmentOrder.garments[0]?.photoId).toBeUndefined();
  });

  it("normalizes local Irish client phone numbers", () => {
    const order = mapOrder(makeRecord({ client: { ...makeClient(), phone: "085 200 9225" } }));

    expect(order.client.phone?.value).toBe("353852009225");
  });

  it("maps null garment price to zero", () => {
    const order = mapOrder(makeRecord({ garments: [makeGarment({ price: null })] }));

    expect(order.garments[0]?.price.isZero()).toBe(true);
  });

  it("throws DirectusMappingError for invalid or missing required dates", () => {
    expect(() => mapOrder(makeRecord({ received_date: "not-a-date" }))).toThrow(DirectusMappingError);
    expect(() => mapOrder(makeRecord({ due_date: "not-a-date" }))).toThrow(DirectusMappingError);
    expect(() => mapOrder(makeRecord({ received_date: undefined as unknown as string }))).toThrow(DirectusMappingError);
    expect(() => mapOrder(makeRecord({ due_date: undefined as unknown as string }))).toThrow(DirectusMappingError);
  });
});

function makeRecord(overrides: Partial<DirectusOrderRecord> = {}): DirectusOrderRecord {
  return {
    id: "order-1",
    date_updated: '2026-08-19T10:05:00.000Z',
    order_number: "260819-0142",
    client: makeClient(),
    status: "received",
    received_date: "2026-08-19T10:00:00.000Z",
    due_date: "2026-08-21T10:00:00.000Z",
    collected_at: null,
    notes: "Bring hanger",
    garments: [makeGarment({ id: "garment-1" }), makeGarment({ id: "garment-2", price: 30 })],
    payments: [makePayment()],
    ...overrides,
  };
}

function makeClient() {
  return {
    id: "client-1",
    name: "Mary",
    phone: "+353 85 200 9225",
    gdpr_consent: true,
    notes: null,
  };
}

function makeGarment(overrides: Partial<DirectusGarmentRecord> = {}): DirectusGarmentRecord {
  return {
    id: "garment-1",
    date_updated: "2026-08-19T10:05:00.000Z",
    description: "Dress",
    alteration_type: "hem",
    measurements: "Hem 4cm",
    photo: "file-1",
    price: "25.00",
    ...overrides,
  };
}

function makePayment(overrides: Partial<DirectusPaymentRecord> = {}): DirectusPaymentRecord {
  return {
    id: "payment-1",
    type: "deposit",
    amount: "20.00",
    method: "cash",
    date_created: "2026-08-19T11:00:00.000Z",
    ...overrides,
  };
}

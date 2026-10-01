import { describe, expect, it } from "vitest";

import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { mapAppointment } from "@/infrastructure/directus/mappers/appointmentMapper";
import type { DirectusAppointmentRecord, DirectusClientRecord, DirectusOrderRecord } from "@/infrastructure/directus/records";

describe("mapAppointment", () => {
  it("maps an appointment with an order_ id", () => {
    const appointment = mapAppointment(makeRecord({ order_: "order-1" }));

    expect(appointment.id).toBe("appointment-1");
    expect(appointment.client?.id).toBe("client-1");
    expect(appointment.clientId).toBe("client-1");
    expect(appointment.orderId).toBe("order-1");
    expect(appointment.order).toBeUndefined();
    expect(appointment.scheduledAt).toEqual(new Date("2026-09-01T10:30:00.000Z"));
    expect(appointment.status).toBe("scheduled");
    expect(appointment.notes).toBe("Fitting");
  });

  it("maps a null order_ as undefined orderId", () => {
    const appointment = mapAppointment(makeRecord({ order_: null }));

    expect(appointment.orderId).toBeUndefined();
    expect(appointment.order).toBeUndefined();
  });

  it("normalizes blank persisted notes as absent", () => {
    expect(mapAppointment(makeRecord({ notes: "" })).notes).toBeUndefined();
  });

  it("maps an expanded order_ relation", () => {
    const appointment = mapAppointment(makeRecord({ order_: makeOrder() }));

    expect(appointment.orderId).toBe("order-1");
    expect(appointment.order?.id).toBe("order-1");
  });

  it("maps the compact expanded order_ relation returned by appointment reads", () => {
    const appointment = mapAppointment(makeRecord({
      order_: {
        id: "order-1",
        order_number: "260901-0142",
        status: "received",
      },
    }));

    expect(appointment.order?.id).toBe("order-1");
    expect(appointment.order?.orderNumber.value).toBe("260901-0142");
    expect(appointment.order?.status.value).toBe("received");
  });


  it("maps a historical appointment without a client relation", () => {
    const appointment = mapAppointment(makeRecord({ client: null, status: "completed" }));

    expect(appointment.client).toBeUndefined();
    expect(appointment.clientId).toBeUndefined();
  });
  it("throws DirectusMappingError for invalid statuses", () => {
    expect(() => mapAppointment(makeRecord({ status: "lost" }))).toThrow(DirectusMappingError);
  });
});

function makeRecord(overrides: Partial<DirectusAppointmentRecord> = {}): DirectusAppointmentRecord {
  return {
    id: "appointment-1",
    client: makeClient(),
    order_: "order-1",
    scheduled_at: "2026-09-01T10:30:00.000Z",
    notes: "Fitting",
    status: "scheduled",
    date_created: "2026-08-23T10:00:00.000Z",
    ...overrides,
  };
}

function makeClient(overrides: Partial<DirectusClientRecord> = {}): DirectusClientRecord {
  return {
    id: "client-1",
    name: "Mary",
    phone: "353852009225",
    gdpr_consent: true,
    notes: null,
    ...overrides,
  };
}

function makeOrder(overrides: Partial<DirectusOrderRecord> = {}): DirectusOrderRecord {
  return {
    id: "order-1",
    date_updated: '2026-08-19T10:05:00.000Z',
    order_number: "260901-0142",
    client: makeClient(),
    status: "received",
    received_date: "2026-09-01T09:00:00.000Z",
    due_date: "2026-09-07T10:00:00.000Z",
    collected_at: null,
    notes: null,
    garments: [],
    payments: [],
    ...overrides,
  };
}

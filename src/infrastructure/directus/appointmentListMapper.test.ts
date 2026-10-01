import { describe, expect, it } from "vitest";

import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { mapAppointmentListItem } from "@/infrastructure/directus/appointmentListMapper";
import type { DirectusAppointmentListRecord } from "@/infrastructure/directus/records";

describe("mapAppointmentListItem", () => {
  it("maps only the fields visible in the agenda", () => {
    const appointment = mapAppointmentListItem(makeRecord());

    expect(appointment).toEqual({
      id: "appointment-1",
      clientId: "client-1",
      clientName: "Mary",
      scheduledAt: new Date("2026-09-01T10:30:00.000Z"),
      status: "scheduled",
      notes: "Fitting",
      linkedOrder: { id: "order-1", orderNumber: "260901-0021", status: "ready" },
    });
  });

  it("rejects malformed dates and statuses", () => {
    expect(() => mapAppointmentListItem(makeRecord({ scheduled_at: "bad" }))).toThrow(DirectusMappingError);
    expect(() => mapAppointmentListItem(makeRecord({ status: "lost" }))).toThrow(DirectusMappingError);
    expect(() => mapAppointmentListItem(makeRecord({ order_: { id: "order-1", order_number: "260901-0021", status: "lost" } }))).toThrow(DirectusMappingError);
  });

  it("normalizes blank notes as absent", () => {
    expect(mapAppointmentListItem(makeRecord({ notes: "" })).notes).toBeUndefined();
  });

  it("keeps historical appointments whose client relation is absent", () => {
    expect(mapAppointmentListItem(makeRecord({ client: null, status: "completed" }))).toMatchObject({
      clientId: undefined,
      clientName: "Deleted client",
      status: "completed",
    });
  });
});

function makeRecord(overrides: Partial<DirectusAppointmentListRecord> = {}): DirectusAppointmentListRecord {
  return {
    id: "appointment-1",
    client: { id: "client-1", name: "Mary" },
    scheduled_at: "2026-09-01T10:30:00.000Z",
    notes: "Fitting",
    status: "scheduled",
    order_: { id: "order-1", order_number: "260901-0021", status: "ready" },
    ...overrides,
  };
}

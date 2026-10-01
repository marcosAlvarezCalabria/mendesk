import { describe, expect, it } from "vitest";

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { UpdateAppointmentDetails } from "@/application/useCases/UpdateAppointmentDetails";
import type { Appointment } from "@/domain/entities/Appointment";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";

const original = appointment();

describe("UpdateAppointmentDetails", () => {
  it("updates only editable details while the appointment is scheduled", async () => {
    const updates: unknown[] = [];
    const repository = {
      updateDetails: async (input: unknown) => { updates.push(input); return appointment({ scheduledAt: new Date("2026-09-13T09:30:00.000Z"), orderId: undefined, notes: "Second fitting" }); },
      getById: async () => original,
    };

    await new UpdateAppointmentDetails(repository).execute({
      appointmentId: "appointment-1",
      expectedScheduledAt: original.scheduledAt,
      expectedOrderId: "order-1",
      expectedNotes: "Fitting",
      scheduledAt: new Date("2026-09-13T09:30:00.000Z"),
      orderId: undefined,
      notes: "Second fitting",
    });

    expect(updates).toEqual([{ appointmentId: "appointment-1", expectedStatus: "scheduled", expectedScheduledAt: original.scheduledAt, expectedOrderId: "order-1", expectedNotes: "Fitting", scheduledAt: new Date("2026-09-13T09:30:00.000Z"), orderId: undefined, notes: "Second fitting" }]);
  });

  it("rejects a missing date before writing", async () => {
    const repository = { updateDetails: async () => original, getById: async () => original };
    await expect(new UpdateAppointmentDetails(repository).execute({ appointmentId: "appointment-1", expectedScheduledAt: original.scheduledAt, scheduledAt: null })).rejects.toThrow("A date and time is required");
  });

  it("treats an unchanged scheduled record as confirmed not saved after an update error", async () => {
    const repository = { updateDetails: async () => { throw new Error("timeout"); }, getById: async () => original };
    await expect(new UpdateAppointmentDetails(repository).execute({ appointmentId: "appointment-1", expectedScheduledAt: original.scheduledAt, expectedOrderId: "order-1", expectedNotes: "Fitting", scheduledAt: new Date("2026-09-13T09:30:00.000Z") })).rejects.toBeInstanceOf(MutationConfirmedNotSavedError);
  });

  it("reports a conflict if the appointment is no longer scheduled", async () => {
    const repository = { updateDetails: async () => { throw new Error("timeout"); }, getById: async () => appointment({ status: "completed" }) };
    await expect(new UpdateAppointmentDetails(repository).execute({ appointmentId: "appointment-1", expectedScheduledAt: original.scheduledAt, scheduledAt: new Date("2026-09-13T09:30:00.000Z") })).rejects.toBeInstanceOf(AppointmentConflictError);
  });

  it("reports a conflict instead of overwriting details changed elsewhere", async () => {
    const repository = { updateDetails: async () => { throw new Error("no row matched"); }, getById: async () => appointment({ notes: "Changed elsewhere" }) };
    await expect(new UpdateAppointmentDetails(repository).execute({ appointmentId: "appointment-1", expectedScheduledAt: original.scheduledAt, expectedOrderId: "order-1", expectedNotes: "Fitting", scheduledAt: new Date("2026-09-13T09:30:00.000Z") })).rejects.toBeInstanceOf(AppointmentConflictError);
  });
});

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "appointment-1",
    client: { id: "client-1", name: "Melissa", phone: null, gdprConsent: true },
    clientId: "client-1",
    orderId: "order-1",
    scheduledAt: new Date("2026-09-12T08:00:00.000Z"),
    status: "scheduled",
    notes: "Fitting",
    ...overrides,
  };
}

import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";
import type { Appointment } from "@/domain/entities/Appointment";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";

export type UpdateAppointmentDetailsInput = {
  appointmentId: string;
  expectedScheduledAt: Date | null;
  expectedOrderId?: string;
  expectedNotes?: string;
  scheduledAt: Date | null;
  orderId?: string;
  notes?: string;
};

export class UpdateAppointmentDetails {
  constructor(private readonly appointments: Pick<AppointmentRepository, "getById" | "updateDetails">) {}

  async execute(input: UpdateAppointmentDetailsInput): Promise<Appointment> {
    if (!input.appointmentId.trim()) throw new Error("Appointment is required");
    if (!input.expectedScheduledAt || Number.isNaN(input.expectedScheduledAt.getTime())) throw new Error("The original date and time is required");
    if (!input.scheduledAt || Number.isNaN(input.scheduledAt.getTime())) throw new Error("A date and time is required");

    const update = {
      appointmentId: input.appointmentId.trim(),
      expectedStatus: "scheduled" as const,
      expectedScheduledAt: input.expectedScheduledAt,
      expectedOrderId: input.expectedOrderId?.trim() || undefined,
      expectedNotes: input.expectedNotes?.trim() || undefined,
      scheduledAt: input.scheduledAt,
      orderId: input.orderId?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
    };

    try {
      return await this.appointments.updateDetails(update);
    } catch (mutationError) {
      let persisted: Appointment | null;
      try {
        persisted = await this.appointments.getById(update.appointmentId);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError([mutationError, reconciliationError], "The appointment update and its reconciliation both failed."),
        });
      }

      if (persisted?.status === "scheduled" && sameDetails(persisted, { scheduledAt: update.scheduledAt, orderId: update.orderId, notes: update.notes })) return persisted;
      if (!persisted || persisted.status !== "scheduled" || !sameDetails(persisted, { scheduledAt: update.expectedScheduledAt, orderId: update.expectedOrderId, notes: update.expectedNotes })) throw new AppointmentConflictError();
      throw new MutationConfirmedNotSavedError({ cause: mutationError });
    }
  }
}

function sameDetails(
  appointment: Appointment,
  expected: Pick<UpdateAppointmentDetailsInput, "scheduledAt" | "orderId" | "notes">,
): boolean {
  return appointment.scheduledAt.getTime() === expected.scheduledAt?.getTime()
    && appointment.orderId === expected.orderId
    && appointment.notes === expected.notes;
}

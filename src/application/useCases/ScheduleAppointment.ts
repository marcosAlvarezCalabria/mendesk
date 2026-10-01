import { createIdempotently } from "@/application/mutations/createIdempotently";
import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";
import type { Appointment } from "@/domain/entities/Appointment";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";
import { formatDublinDateTime } from "@/domain/time/dublinDateTime";

export type ScheduleAppointmentInput = { appointmentId: string; clientId: string; orderId?: string; scheduledAt: Date | null | undefined; notes?: string };

export class ScheduleAppointment {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(input: ScheduleAppointmentInput): Promise<Appointment> {
    const clientId = input.clientId.trim();

    if (!clientId) {
      throw new Error("Client is required");
    }

    if (!input.scheduledAt || Number.isNaN(input.scheduledAt.getTime())) {
      throw new Error("A date and time is required");
    }

    const appointmentId = IdempotencyKey.fromString(input.appointmentId).value;
    const requested = { clientId, orderId: input.orderId, scheduledAt: input.scheduledAt, notes: input.notes };
    return createIdempotently({
      lookup: () => this.appointments.getById(appointmentId),
      create: () => this.appointments.create({ ...requested, id: appointmentId }),
      isCompatible: (appointment) => {
        const mismatchedFields = [
          appointment.clientId === requested.clientId ? undefined : "client",
          appointment.orderId === requested.orderId ? undefined : "order",
          appointment.scheduledAt.getTime() === requested.scheduledAt.getTime() ? undefined : "date/time",
          normalizedNotes(appointment.notes) === normalizedNotes(requested.notes) ? undefined : "notes",
        ].filter((field): field is string => Boolean(field));
        if (mismatchedFields.length > 0) {
          const mismatchDetails = mismatchedFields.includes("date/time")
            ? [`saved=${appointment.scheduledAt.toISOString()} (${formatDublinDateTime(appointment.scheduledAt)} Dublin), requested=${requested.scheduledAt.toISOString()} (${formatDublinDateTime(requested.scheduledAt)} Dublin)`]
            : [];
          throw new IdempotencyConflictError(mismatchedFields, mismatchDetails);
        }
        return true;
      },
    });
  }
}

function normalizedNotes(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

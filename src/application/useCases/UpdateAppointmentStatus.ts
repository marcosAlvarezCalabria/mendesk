import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";
import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import type { Appointment } from "@/domain/entities/Appointment";
import { AppointmentConflictError } from "@/domain/errors/AppointmentConflictError";
import { isAppointmentStatus } from "@/domain/values/AppointmentStatus";

export type UpdateAppointmentStatusInput = {
  appointmentId: string;
  expectedStatus: string;
  status: string;
};

export class UpdateAppointmentStatus {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(input: UpdateAppointmentStatusInput): Promise<Appointment> {
    if (!isAppointmentStatus(input.status) || !isAppointmentStatus(input.expectedStatus)) {
      throw new Error("Invalid appointment status");
    }

    try {
      return await this.appointments.updateStatus({
        appointmentId: input.appointmentId,
        expectedStatus: input.expectedStatus,
        status: input.status,
      });
    } catch (mutationError) {
      let persisted: Appointment | null;
      try {
        persisted = await this.appointments.getById(input.appointmentId);
      } catch (reconciliationError) {
        throw new MutationOutcomeUnknownError({
          cause: new AggregateError(
            [mutationError, reconciliationError],
            "The appointment status update and its reconciliation both failed.",
          ),
        });
      }

      if (persisted?.status === input.status) {
        return persisted;
      }

      if (!persisted || persisted.status !== input.expectedStatus) {
        throw new AppointmentConflictError();
      }

      throw new MutationConfirmedNotSavedError({ cause: mutationError });
    }
  }
}

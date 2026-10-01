import type { AppointmentListReader } from "@/application/ports/AppointmentListReader";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";

export type ListAppointmentsInput = { from?: Date; to?: Date; statuses?: readonly AppointmentStatus[] };

export class ListAppointments {
  constructor(private readonly appointments: AppointmentListReader) {}

  async execute(input: ListAppointmentsInput = {}): Promise<AppointmentListItem[]> {
    return this.appointments.list({ from: input.from, to: input.to, statuses: input.statuses });
  }
}

import type { AppointmentRepository } from "@/application/ports/AppointmentRepository";

export class DeleteScheduledAppointment {
  constructor(private readonly appointments: AppointmentRepository) {}

  async execute(appointmentId: string): Promise<void> {
    const id = appointmentId.trim();
    if (!id) throw new Error("Appointment is required");

    const appointment = await this.appointments.getById(id);
    if (!appointment) return;
    if (appointment.status !== "scheduled") throw new Error("Only scheduled appointments can be deleted");

    await this.appointments.deleteScheduled(id);
  }
}

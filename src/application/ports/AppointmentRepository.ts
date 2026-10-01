import type { Appointment } from "@/domain/entities/Appointment";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";

export type NewAppointment = { id: string; clientId: string; orderId?: string; scheduledAt: Date; notes?: string };
export type AppointmentDetailsUpdate = {
  appointmentId: string;
  expectedStatus: "scheduled";
  expectedScheduledAt: Date;
  expectedOrderId?: string;
  expectedNotes?: string;
  scheduledAt: Date;
  orderId?: string;
  notes?: string;
};

export interface AppointmentRepository {
  getById(appointmentId: string): Promise<Appointment | null>;
  create(appointment: NewAppointment): Promise<Appointment>;
  updateDetails(input: AppointmentDetailsUpdate): Promise<Appointment>;
  updateStatus(input: {
    appointmentId: string;
    expectedStatus: AppointmentStatus;
    status: AppointmentStatus;
  }): Promise<Appointment>;
  deleteScheduled(appointmentId: string): Promise<void>;
}

export type AppointmentStatus = "scheduled" | "completed" | "cancelled";

export const APPOINTMENT_STATUSES: readonly AppointmentStatus[] = ["scheduled", "completed", "cancelled"];

export function isAppointmentStatus(value: string): value is AppointmentStatus {
  return APPOINTMENT_STATUSES.includes(value as AppointmentStatus);
}

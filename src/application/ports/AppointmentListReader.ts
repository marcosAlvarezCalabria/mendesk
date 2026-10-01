import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";

export type AppointmentListQuery = { from?: Date; to?: Date; statuses?: readonly AppointmentStatus[] };

export interface AppointmentListReader {
  list(query: AppointmentListQuery): Promise<AppointmentListItem[]>;
}

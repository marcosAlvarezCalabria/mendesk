import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";

export type AppointmentHistoryQuery = {
  limit: number;
  search?: string;
  status?: "completed" | "cancelled";
};

export type AppointmentHistoryPage = {
  items: AppointmentListItem[];
  hasEarlier: boolean;
};

export interface AppointmentHistoryReader {
  listHistory(query: AppointmentHistoryQuery): Promise<AppointmentHistoryPage>;
}

import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

export type AppointmentListItem = {
  id: string;
  clientId?: string;
  clientName: string;
  scheduledAt: Date;
  status: AppointmentStatus;
  notes?: string;
  linkedOrder?: { id: string; orderNumber: string; status: OrderStatusValue };
};

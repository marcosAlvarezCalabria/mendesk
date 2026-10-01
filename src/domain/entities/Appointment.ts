import type { Client } from "@/domain/entities/Client";
import type { Order } from "@/domain/entities/Order";
import type { AppointmentStatus } from "@/domain/values/AppointmentStatus";

export type Appointment = {
  readonly id: string;
  readonly client?: Client;
  readonly clientId?: string;
  readonly order?: Pick<Order, "id" | "orderNumber" | "status">;
  readonly orderId?: string;
  readonly scheduledAt: Date;
  readonly status: AppointmentStatus;
  readonly notes?: string;
};
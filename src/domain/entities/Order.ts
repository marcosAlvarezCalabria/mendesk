import type { Client } from "@/domain/entities/Client";
import type { Garment } from "@/domain/entities/Garment";
import type { Payment } from "@/domain/entities/Payment";
import type { OrderNumber } from "@/domain/values/OrderNumber";
import type { OrderStatus } from "@/domain/values/OrderStatus";

export type Order = {
  readonly id: string;
  readonly orderNumber: OrderNumber;
  readonly client: Client;
  readonly status: OrderStatus;
  readonly receivedDate: Date;
  readonly dateUpdated: Date;
  readonly dueDate: Date;
  readonly collectedAt?: Date;
  readonly notes?: string;
  readonly garments: readonly Garment[];
  readonly payments: readonly Payment[];
};
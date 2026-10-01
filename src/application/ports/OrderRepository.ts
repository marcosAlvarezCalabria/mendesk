import type { Order } from "@/domain/entities/Order";
import type { OrderNumber } from "@/domain/values/OrderNumber";
import type { OrderStatus } from "@/domain/values/OrderStatus";
import type { IdempotencyKey } from "@/domain/values/IdempotencyKey";

export type NewOrder = {
  idempotencyKey: IdempotencyKey;
  orderNumber: OrderNumber;
  clientId: string;
  status: OrderStatus;
  receivedDate: Date;
  dueDate: Date;
  notes?: string;
};

export type UpdateOrderDetails = {
  orderId: string;
  expectedDateUpdated: Date;
  dueDate: Date;
  notes?: string;
};
export type UpdateOrderStatus = {
  orderId: string;
  expectedStatus: OrderStatus;
  expectedDateUpdated?: Date;
  status: OrderStatus;
  collectedAt?: Date;
};

export interface OrderRepository {
  getByOrderNumber(orderNumber: string): Promise<Order | null>;
  getByIdempotencyKey(idempotencyKey: IdempotencyKey): Promise<Order | null>;
  create(order: NewOrder): Promise<Order>;
  updateDetails(input: UpdateOrderDetails): Promise<Order>;
  updateStatus(input: UpdateOrderStatus): Promise<Order>;
}

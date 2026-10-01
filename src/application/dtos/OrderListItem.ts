import type { Money } from "@/domain/values/Money";
import type { OrderNumber } from "@/domain/values/OrderNumber";
import type { OrderStatus } from "@/domain/values/OrderStatus";

export type OrderListItem = {
  id: string;
  orderNumber: OrderNumber;
  clientName: string;
  status: OrderStatus;
  dueDate: Date;
  garmentCount: number;
  outstanding: Money;
};

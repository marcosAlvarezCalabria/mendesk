import type { Order } from "@/domain/entities/Order";
import { isEditable } from "@/domain/orders/orderRules";

export function canEditOrder(order: Order): boolean {
  return isEditable(order);
}

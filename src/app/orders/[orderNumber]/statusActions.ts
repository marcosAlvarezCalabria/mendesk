import type { Order } from "@/domain/entities/Order";
import { OrderStatus } from "@/domain/values/OrderStatus";

export type StatusAction = "ready" | "collected" | "cancelled";

const STATUS_ACTIONS: Record<StatusAction, OrderStatus> = {
  ready: OrderStatus.READY,
  collected: OrderStatus.COLLECTED,
  cancelled: OrderStatus.CANCELLED,
};

export function isStatusAction(value: string): value is StatusAction {
  return Object.hasOwn(STATUS_ACTIONS, value);
}

export function availableStatusActions(order: Order): StatusAction[] {
  return (Object.keys(STATUS_ACTIONS) as StatusAction[]).filter((action) => order.status.canTransitionTo(STATUS_ACTIONS[action]));
}

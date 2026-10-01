import type { OrderListItem } from "@/application/dtos/OrderListItem";

export type OrderCardAction =
  | { kind: "status"; target: "ready" | "collected" }
  | { kind: "payment" }
  | null;

export function orderCardAction(
  order: Pick<OrderListItem, "status" | "outstanding">,
): OrderCardAction {
  if (order.status.value === "received") {
    return { kind: "status", target: "ready" };
  }

  if (order.status.value === "ready") {
    if (!order.outstanding.isZero()) {
      return { kind: "payment" };
    }

    return { kind: "status", target: "collected" };
  }

  return null;
}

import { InvalidStatusTransitionError } from "@/domain/errors/InvalidStatusTransitionError";

export type OrderStatusValue = "received" | "ready" | "collected" | "cancelled";

export class OrderStatus {
  static readonly RECEIVED = new OrderStatus("received");
  static readonly READY = new OrderStatus("ready");
  static readonly COLLECTED = new OrderStatus("collected");
  static readonly CANCELLED = new OrderStatus("cancelled");

  private constructor(readonly value: OrderStatusValue) {}

  canTransitionTo(next: OrderStatus): boolean {
    if (this.equals(OrderStatus.RECEIVED)) {
      return next.equals(OrderStatus.READY) || next.equals(OrderStatus.CANCELLED);
    }

    if (this.equals(OrderStatus.READY)) {
      return next.equals(OrderStatus.COLLECTED) || next.equals(OrderStatus.CANCELLED);
    }

    return false;
  }

  transitionTo(next: OrderStatus): OrderStatus {
    if (!this.canTransitionTo(next)) {
      throw new InvalidStatusTransitionError();
    }

    return next;
  }

  equals(other: OrderStatus): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}

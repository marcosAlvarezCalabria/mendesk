import type { Order } from "@/domain/entities/Order";
import { MissingDueDateError } from "@/domain/errors/MissingDueDateError";
import { OrderNotEditableError } from "@/domain/errors/OrderNotEditableError";
import { Money } from "@/domain/values/Money";
import { OrderStatus } from "@/domain/values/OrderStatus";

export function outstandingBalance(order: Order): Money {
  const totalPrice = order.garments.reduce((total, garment) => total.add(garment.price), Money.zero());
  const totalPaid = order.payments.reduce((total, payment) => total.add(payment.amount), Money.zero());

  return totalPrice.subtract(totalPaid);
}

export function isOverdue(order: Pick<Order, "dueDate" | "status">, today: Date): boolean {
  return order.dueDate.getTime() < today.getTime() && order.status.equals(OrderStatus.RECEIVED);
}

export function isEditable(order: Pick<Order, "status">): boolean {
  return !order.status.equals(OrderStatus.COLLECTED) && !order.status.equals(OrderStatus.CANCELLED);
}

export function assertEditable(order: Order): void {
  if (!isEditable(order)) {
    throw new OrderNotEditableError();
  }
}

export function assertPaymentAllowed(order: Order, amount: Money): void {
  assertEditable(order);

  if (amount.isZero()) {
    throw new Error("Payment amount must be greater than zero.");
  }

  if (amount.cents > outstandingBalance(order).cents) {
    throw new Error("Payment amount exceeds the outstanding balance.");
  }
}

export function assertDueDate(dueDate: Date | null | undefined): Date {
  if (!dueDate || Number.isNaN(dueDate.getTime())) {
    throw new MissingDueDateError();
  }

  return dueDate;
}

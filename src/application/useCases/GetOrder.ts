import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { Order } from "@/domain/entities/Order";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";

export class GetOrder {
  constructor(private readonly orders: OrderRepository) {}

  async execute(orderNumber: string): Promise<Order> {
    const trimmedOrderNumber = orderNumber.trim();

    if (!trimmedOrderNumber) {
      throw new OrderNotFoundError();
    }

    const order = await this.orders.getByOrderNumber(trimmedOrderNumber);

    if (!order) {
      throw new OrderNotFoundError();
    }

    return order;
  }
}
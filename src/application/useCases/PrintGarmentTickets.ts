import type { OrderRepository } from "@/application/ports/OrderRepository";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { buildTicket, type TicketData } from "@/domain/orders/buildTicket";

export class PrintGarmentTickets {
  constructor(
    private readonly orders: OrderRepository,
    private readonly panelBaseUrl: string,
  ) {}

  async execute(orderNumber: string): Promise<TicketData[]> {
    const order = await this.orders.getByOrderNumber(orderNumber);
    if (!order) throw new OrderNotFoundError();
    return order.garments.map(garment => buildTicket(order, garment, this.panelBaseUrl));
  }
}

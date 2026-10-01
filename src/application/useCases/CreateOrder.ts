import { createIdempotently } from "@/application/mutations/createIdempotently";
import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { OrderSequenceProvider } from "@/application/ports/OrderSequenceProvider";
import type { Order } from "@/domain/entities/Order";
import { assertDueDate } from "@/domain/orders/orderRules";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { OrderStatus } from "@/domain/values/OrderStatus";

export type CreateOrderInput = {
  idempotencyKey: string;
  clientId: string;
  receivedDate: Date;
  dueDate: Date | null | undefined;
  notes?: string;
};

export class CreateOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly sequence: OrderSequenceProvider,
  ) {}

  async execute(input: CreateOrderInput): Promise<Order> {
    if (!input.clientId.trim()) throw new RangeError("Client is required");
    const idempotencyKey = IdempotencyKey.fromString(input.idempotencyKey);
    const dueDate = assertDueDate(input.dueDate);
    return createIdempotently({
      lookup: () => this.orders.getByIdempotencyKey(idempotencyKey),
      create: async () => {
        const sequence = await this.sequence.next();
        return this.orders.create({
          idempotencyKey,
          orderNumber: OrderNumber.compose(input.receivedDate, sequence),
          clientId: input.clientId,
          status: OrderStatus.RECEIVED,
          receivedDate: input.receivedDate,
          dueDate,
          notes: input.notes,
        });
      },
      isCompatible: (order) => order.client.id === input.clientId
        && order.status.equals(OrderStatus.RECEIVED)
        && order.dueDate.getTime() === dueDate.getTime()
        && (order.notes ?? "") === (input.notes ?? ""),
    });
  }
}

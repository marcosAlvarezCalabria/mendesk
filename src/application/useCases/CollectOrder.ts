import type { OrderRepository } from "@/application/ports/OrderRepository";
import type { PaymentRepository } from "@/application/ports/PaymentRepository";
import { ChangeOrderStatus } from "@/application/useCases/ChangeOrderStatus";
import { RecordPayment } from "@/application/useCases/RecordPayment";
import type { Order } from "@/domain/entities/Order";
import { OrderNotFoundError } from "@/domain/errors/OrderNotFoundError";
import { outstandingBalance } from "@/domain/orders/orderRules";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { Money } from "@/domain/values/Money";
import { OrderStatus } from "@/domain/values/OrderStatus";

export type CollectOrderInput = {
  orderNumber: string;
  expectedDateUpdated: string;
  idempotencyKey: string;
  amountEuros: number;
  method: string;
};

export type CollectOrderResult = { order: Order; paymentRecorded: boolean };

export class CollectOrderPartialError extends Error {
  readonly paymentRecorded = true;

  constructor(options?: ErrorOptions) {
    super("Payment recorded — order still Ready.", options);
    this.name = "CollectOrderPartialError";
  }
}

export class CollectOrder {
  constructor(
    private readonly orders: OrderRepository,
    private readonly payments: PaymentRepository,
  ) {}

  async execute(input: CollectOrderInput): Promise<CollectOrderResult> {
    const order = await this.orders.getByOrderNumber(input.orderNumber);
    if (!order) throw new OrderNotFoundError();

    order.status.transitionTo(OrderStatus.COLLECTED);

    const outstanding = outstandingBalance(order);
    const idempotencyKey = IdempotencyKey.fromString(input.idempotencyKey);
    const existingPayment = await this.payments.getByIdempotencyKey(idempotencyKey);
    let paymentRecorded = Boolean(existingPayment);

    if (existingPayment) {
      await new RecordPayment(this.payments).execute({
        orderId: order.id,
        idempotencyKey: input.idempotencyKey,
        type: "final",
        amountEuros: input.amountEuros,
        method: input.method,
      });
    } else if (!outstanding.isZero()) {
      const amount = Money.fromEuros(input.amountEuros);
      if (!amount.equals(outstanding)) {
        throw new Error("Final payment must equal the outstanding balance.");
      }

      await new RecordPayment(this.payments).execute({
        orderId: order.id,
        idempotencyKey: input.idempotencyKey,
        type: "final",
        amountEuros: input.amountEuros,
        method: input.method,
      });
      paymentRecorded = true;
    } else if (input.amountEuros !== 0) {
      throw new Error("Final payment must equal the outstanding balance.");
    }

    try {
      const collected = await new ChangeOrderStatus(this.orders).execute({
        orderNumber: input.orderNumber,
        target: "collected",
        expectedStatus: "ready",
        expectedDateUpdated: input.expectedDateUpdated,
      });
      return { order: collected, paymentRecorded };
    } catch (error) {
      if (paymentRecorded) throw new CollectOrderPartialError({ cause: error });
      throw error;
    }
  }
}

import type { OrderListItem } from "@/application/dtos/OrderListItem";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus, type OrderStatusValue } from "@/domain/values/OrderStatus";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import type { DirectusOrderListRecord } from "@/infrastructure/directus/records";

const ORDER_STATUSES: Record<OrderStatusValue, OrderStatus> = {
  received: OrderStatus.RECEIVED,
  ready: OrderStatus.READY,
  collected: OrderStatus.COLLECTED,
  cancelled: OrderStatus.CANCELLED,
};

export function mapOrderListItem(record: DirectusOrderListRecord): OrderListItem {
  const status = ORDER_STATUSES[record.status as OrderStatusValue];
  if (!status) {
    throw new DirectusMappingError(`Unknown Directus order status: ${record.status}`);
  }

  const dueDate = new Date(record.due_date);
  if (Number.isNaN(dueDate.getTime())) {
    throw new DirectusMappingError("Invalid Directus date field: due_date");
  }

  const garmentTotal = (record.garments ?? []).reduce(
    (total, garment) => total.add(mapMoney(garment.price, true)),
    Money.zero(),
  );
  const paymentTotal = (record.payments ?? []).reduce(
    (total, payment) => total.add(mapMoney(payment.amount, false)),
    Money.zero(),
  );

  return {
    id: record.id,
    orderNumber: OrderNumber.fromString(record.order_number),
    clientName: record.client.name,
    status,
    dueDate,
    garmentCount: record.garments?.length ?? 0,
    outstanding: garmentTotal.subtract(paymentTotal),
  };
}

function mapMoney(value: number | string | null, optional: boolean): Money {
  if (value === null) {
    if (optional) {
      return Money.zero();
    }

    throw new DirectusMappingError("Invalid Directus money value");
  }

  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    throw new DirectusMappingError("Invalid Directus money value");
  }

  return Money.fromEuros(amount);
}

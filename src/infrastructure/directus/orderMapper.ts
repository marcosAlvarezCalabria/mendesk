import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import type { Payment } from "@/domain/entities/Payment";
import { Money } from "@/domain/values/Money";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus, type OrderStatusValue } from "@/domain/values/OrderStatus";
import { toAlterationType } from "@/domain/values/AlterationType";
import { isPaymentMethod } from "@/domain/values/PaymentMethod";
import { isPaymentType } from "@/domain/values/PaymentType";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { mapClient } from "@/infrastructure/directus/mappers/clientMapper";
import type {
  DirectusGarmentRecord,
  DirectusOrderRecord,
  DirectusPaymentRecord,
} from "@/infrastructure/directus/records";

const ORDER_STATUSES: Record<OrderStatusValue, OrderStatus> = {
  received: OrderStatus.RECEIVED,
  ready: OrderStatus.READY,
  collected: OrderStatus.COLLECTED,
  cancelled: OrderStatus.CANCELLED,
};

export function mapOrder(record: DirectusOrderRecord): Order {
  return {
    id: record.id,
    orderNumber: OrderNumber.fromString(record.order_number),
    client: mapClient(record.client),
    status: mapStatus(record.status),
    receivedDate: mapRequiredDate(record.received_date, "received_date"),
    dueDate: mapRequiredDate(record.due_date, "due_date"),
    collectedAt: mapOptionalDate(record.collected_at, "collected_at"),
    dateUpdated: mapVersionDate(record),
    notes: nullableToUndefined(record.notes),
    garments: (record.garments ?? []).map(mapGarment),
    payments: (record.payments ?? []).map(mapPayment),
  };
}

export function mapGarment(record: DirectusGarmentRecord): Garment {
  return {
    id: record.id,
    orderId: mapRelationId(record.order),
    description: record.description,
    alterationType: toAlterationType(record.alteration_type ?? ""),
    measurements: nullableToUndefined(record.measurements),
    dateUpdated: mapVersionDate(record),
    photoId: mapPhotoId(record.photo),
    price: mapOptionalMoney(record.price),
  };
}

function mapPhotoId(value: DirectusGarmentRecord["photo"]): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "object" && value !== null) {
    return value.id;
  }

  return undefined;
}

export function mapPayment(record: DirectusPaymentRecord): Payment {
  if (!isPaymentType(record.type)) {
    throw new DirectusMappingError(`Unknown Directus payment type: ${record.type}`);
  }

  if (!isPaymentMethod(record.method)) {
    throw new DirectusMappingError(`Unknown Directus payment method: ${record.method}`);
  }

  return {
    id: record.id,
    orderId: mapRelationId(record.order),
    type: record.type,
    amount: mapMoney(record.amount),
    method: record.method,
    createdAt: mapRequiredDate(record.date_created, "date_created"),
  };
}

function mapRelationId(value: string | { id: string } | undefined): string | undefined {
  return typeof value === "string" ? value : value?.id;
}

function mapStatus(value: string): OrderStatus {
  const status = ORDER_STATUSES[value as OrderStatusValue];

  if (!status) {
    throw new DirectusMappingError(`Unknown Directus order status: ${value}`);
  }

  return status;
}

function mapVersionDate(record: { date_updated: string | null; date_created?: string }): Date {
  // Directus has no update timestamp until the first write after creation.
  // Initial-version writes also require date_updated IS NULL (see directusVersionFilter).
  return record.date_updated === null
    ? mapRequiredDate(record.date_created, "date_created")
    : mapRequiredDate(record.date_updated, "date_updated");
}

function mapRequiredDate(value: string | null | undefined, fieldName: string): Date {
  if (typeof value !== "string" || value.trim() === "") {
    throw new DirectusMappingError(`Missing Directus date field: ${fieldName}`);
  }

  return mapDate(value, fieldName);
}

function mapOptionalDate(value: string | null, fieldName: string): Date | undefined {
  if (value === null) {
    return undefined;
  }

  return mapDate(value, fieldName);
}

function mapDate(value: string, fieldName: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new DirectusMappingError(`Invalid Directus date field: ${fieldName}`);
  }

  return date;
}

function mapOptionalMoney(value: number | string | null): Money {
  if (value === null) {
    return Money.zero();
  }

  return mapMoney(value);
}

function mapMoney(value: number | string): Money {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    throw new DirectusMappingError("Invalid Directus money value");
  }

  return Money.fromEuros(amount);
}

function nullableToUndefined<T>(value: T | null): T | undefined {
  return value ?? undefined;
}

import type { Appointment } from "@/domain/entities/Appointment";
import type { Client } from "@/domain/entities/Client";
import { isAppointmentStatus } from "@/domain/values/AppointmentStatus";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus, type OrderStatusValue } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { mapClient } from "@/infrastructure/directus/mappers/clientMapper";
import type { DirectusAppointmentOrderRecord, DirectusAppointmentRecord } from "@/infrastructure/directus/records";
import { parseStoredDublinDateTime } from "@/domain/time/dublinDateTime";

export function mapAppointment(record: DirectusAppointmentRecord): Appointment {
  if (!isAppointmentStatus(record.status)) {
    throw new DirectusMappingError(`Unknown Directus appointment status: ${record.status}`);
  }

  const scheduledAt = parseStoredDublinDateTime(record.scheduled_at);

  if (!scheduledAt) {
    throw new DirectusMappingError("Invalid Directus date field: scheduled_at");
  }

  const clientId = record.client ? relationId(record.client) : undefined;
  const orderId = record.order_ ? relationId(record.order_) : undefined;

  return {
    id: record.id,
    client: record.client ? (typeof record.client === "string" ? placeholderClient(record.client) : mapClient(record.client)) : undefined,
    clientId,
    order: typeof record.order_ === "object" && record.order_ !== null ? mapAppointmentOrder(record.order_) : undefined,
    orderId,
    scheduledAt,
    status: record.status,
    notes: record.notes?.trim() || undefined,
  };
}

function relationId(record: string | { id: string }): string {
  return typeof record === "string" ? record : record.id;
}

const ORDER_STATUSES: Record<OrderStatusValue, OrderStatus> = {
  received: OrderStatus.RECEIVED,
  ready: OrderStatus.READY,
  collected: OrderStatus.COLLECTED,
  cancelled: OrderStatus.CANCELLED,
};

function mapAppointmentOrder(record: DirectusAppointmentOrderRecord): NonNullable<Appointment["order"]> {
  const status = ORDER_STATUSES[record.status as OrderStatusValue];

  if (!status) {
    throw new DirectusMappingError(`Unknown Directus order status: ${record.status}`);
  }

  return {
    id: record.id,
    orderNumber: OrderNumber.fromString(record.order_number),
    status,
  };
}

function placeholderClient(id: string): Client {
  return {
    id,
    name: "",
    phone: PhoneNumber.fromRaw("0850000000"),
    gdprConsent: false,
  };
}

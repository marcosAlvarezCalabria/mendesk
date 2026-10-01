import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import { isAppointmentStatus } from "@/domain/values/AppointmentStatus";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import type { DirectusAppointmentListRecord } from "@/infrastructure/directus/records";
import { parseStoredDublinDateTime } from "@/domain/time/dublinDateTime";

import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
export function mapAppointmentListItem(record: DirectusAppointmentListRecord): AppointmentListItem {
  if (!isAppointmentStatus(record.status)) {
    throw new DirectusMappingError(`Unknown Directus appointment status: ${record.status}`);
  }

  const scheduledAt = parseStoredDublinDateTime(record.scheduled_at);

  if (!scheduledAt) {
    throw new DirectusMappingError("Invalid Directus date field: scheduled_at");
  }

  const linkedOrder = record.order_ ? mapLinkedOrder(record.order_) : undefined;

  return {
    id: record.id,
    clientId: record.client?.id,
    clientName: record.client?.name || ANONYMIZED_CLIENT_NAME,
    scheduledAt,
    status: record.status,
    notes: record.notes?.trim() || undefined,
    linkedOrder,
  };
}

function mapLinkedOrder(order: NonNullable<DirectusAppointmentListRecord["order_"]>): NonNullable<AppointmentListItem["linkedOrder"]> {
  if (!isOrderStatus(order.status)) {
    throw new DirectusMappingError(`Unknown Directus order status: ${order.status}`);
  }

  return { id: order.id, orderNumber: order.order_number, status: order.status };
}

function isOrderStatus(value: string): value is OrderStatusValue {
  return value === "received" || value === "ready" || value === "collected" || value === "cancelled";
}

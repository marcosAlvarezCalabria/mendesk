import type { Order } from "@/domain/entities/Order";
import type { AlterationType } from "@/domain/values/AlterationType";
import type { PaymentType } from "@/domain/values/PaymentType";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";

export type OrderSnapshot = {
  id: string;
  orderNumber: string;
  client: { id: string; name: string; phone: string | null; gdprConsent: boolean; notes: string | null };
  status: Order["status"]["value"];
  receivedDate: string;
  dateUpdated: string;
  dueDate: string;
  collectedAt: string | null;
  notes: string | null;
  garments: readonly { id: string; description: string; dateUpdated: string; alterationType: AlterationType; measurements: string | null; photoId: string | null; priceCents: number }[];
  payments: readonly { id: string; type: PaymentType; amountCents: number; method: PaymentMethod; createdAt: string }[];
};

export function toOrderSnapshot(order: Order): OrderSnapshot {
  return {
    id: order.id, orderNumber: order.orderNumber.value,
    client: { id: order.client.id, name: order.client.name, phone: order.client.phone?.value ?? null, gdprConsent: order.client.gdprConsent, notes: order.client.notes ?? null },
    status: order.status.value, receivedDate: order.receivedDate.toISOString(),
    dateUpdated: order.dateUpdated.toISOString(), dueDate: order.dueDate.toISOString(),
    collectedAt: order.collectedAt?.toISOString() ?? null, notes: order.notes ?? null,
    garments: order.garments.map((garment) => ({
      id: garment.id, description: garment.description, dateUpdated: garment.dateUpdated.toISOString(),
      alterationType: garment.alterationType, measurements: garment.measurements ?? null,
      photoId: garment.photoId ?? null, priceCents: garment.price.cents,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id, type: payment.type, amountCents: payment.amount.cents,
      method: payment.method, createdAt: payment.createdAt.toISOString(),
    })),
  };
}

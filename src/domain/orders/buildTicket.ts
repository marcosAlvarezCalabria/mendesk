import type { Garment } from "@/domain/entities/Garment";
import type { Order } from "@/domain/entities/Order";
import { buildOrderDeepLink } from "@/domain/orders/buildOrderDeepLink";
import { outstandingBalance } from "@/domain/orders/orderRules";
import type { AlterationType } from "@/domain/values/AlterationType";
import { Money } from "@/domain/values/Money";

const CANONICAL_PANEL_URL = "https://panel.kokoatelier.ie";

export type TicketData = {
  readonly orderNumber: string;
  readonly clientName: string;
  readonly garmentDescription: string;
  readonly alterationType: AlterationType;
  readonly measurements: string | null;
  readonly price: string;
  readonly depositPaid: string;
  readonly outstanding: string;
  readonly dueDate: Date;
  readonly deepLinkUrl: string;
};

export function buildTicket(order: Order, garment: Garment): TicketData {
  const depositPaid = order.payments.filter(payment => payment.type === "deposit").reduce((total, payment) => total.add(payment.amount), Money.zero());

  return {
    orderNumber: order.orderNumber.value,
    clientName: order.client.name,
    garmentDescription: garment.description,
    alterationType: garment.alterationType,
    measurements: garment.measurements ?? null,
    price: garment.price.toString(),
    depositPaid: depositPaid.toString(),
    outstanding: outstandingBalance(order).toString(),
    dueDate: order.dueDate,
    deepLinkUrl: buildOrderDeepLink(order, CANONICAL_PANEL_URL),
  };
}

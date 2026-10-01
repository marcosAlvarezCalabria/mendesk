import type { OrdersBalance, OrdersOverviewItem } from "@/application/dtos/OrdersOverview";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { DirectusMappingError } from "./DirectusMappingError";

export type OrdersOverviewRecord = {
  id: string; order_number: string; status: string; received_date: string; due_date: string; client: { name: string };
  garments: { id: string; price: string | number | null }[];
  payments: { id: string; amount: string | number | null }[];
};

export function mapOrdersOverviewItem(record: OrdersOverviewRecord): OrdersOverviewItem {
  if (!record || typeof record.id !== "string" || !record.id
    || typeof record.client?.name !== "string"
    || !["received", "ready", "collected", "cancelled"].includes(record.status)
    || !record.client.name.trim()
    || typeof record.received_date !== "string" || !Number.isFinite(new Date(record.received_date).getTime())
    || typeof record.due_date !== "string" || !Number.isFinite(new Date(record.due_date).getTime())
    || !Array.isArray(record.garments) || !Array.isArray(record.payments)) {
    throw new DirectusMappingError("Invalid overview order");
  }
  const orderNumber = OrderNumber.fromString(record.order_number).value;
  let balance: OrdersBalance;
  try {
    const prices = sum(record.garments.map(row => cents(row.price, true)));
    const payments = sum(record.payments.map(row => cents(row.amount, false)));
    balance = payments > prices
      ? { status: "inconsistent", issue: { orderId: record.id, orderNumber, reason: "overpaid" } }
      : { status: "ready", outstandingCents: prices - payments, paidCents: payments };
  } catch {
    balance = { status: "inconsistent", issue: { orderId: record.id, orderNumber, reason: "invalid-money" } };
  }
  return { id: record.id, orderNumber, clientName: record.client.name, status: record.status as OrderStatusValue,
    receivedDate: new Date(record.received_date).toISOString(), dueDate: new Date(record.due_date).toISOString(), garmentCount: record.garments.length, balance };
}

function cents(value: unknown, nullable: boolean): number {
  if (value === null && nullable) return 0;
  if (typeof value !== "string" && typeof value !== "number") throw new Error("Invalid money");
  const text = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error("Invalid money");
  const [whole, fraction = ""] = text.split(".");
  if (/[^0]/.test(fraction.slice(2))) throw new Error("Sub-cent money");
  const cents = fraction.slice(0, 2).padEnd(2, "0");
  const amount = BigInt(whole) * BigInt(100) + BigInt(cents);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Unsafe money");
  return Number(amount);
}

function sum(values: number[]): number {
  const total = values.reduce((result, value) => result + value, 0);
  if (!Number.isSafeInteger(total)) throw new Error("Unsafe total");
  return total;
}

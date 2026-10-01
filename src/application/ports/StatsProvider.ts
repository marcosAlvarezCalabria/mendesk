import type { Money } from "@/domain/values/Money";
import type { PaymentMethod } from "@/domain/values/PaymentMethod";

export type PaymentPoint = { amount: Money; createdAt: Date; method: PaymentMethod };
export type OrderPoint = { receivedDate: Date; status: string; total: Money; paid: Money };

export interface StatsProvider {
  paymentsBetween(from: Date, to: Date): Promise<PaymentPoint[]>;
  ordersBetween(from: Date, to: Date): Promise<OrderPoint[]>;
  activeOrders(): Promise<OrderPoint[]>;
  newClientsBetween(from: Date, to: Date): Promise<number>;
}
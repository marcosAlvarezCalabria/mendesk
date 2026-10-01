import type { OrderPoint, PaymentPoint, StatsProvider } from "@/application/ports/StatsProvider";
import { Money } from "@/domain/values/Money";
import { isPaymentMethod } from "@/domain/values/PaymentMethod";
import type { DirectusOrderPointRecord, DirectusPaymentPointRecord, DirectusStatsGateway } from "@/infrastructure/directus/DirectusStatsGateway";

export class DirectusStatsProvider implements StatsProvider {
  constructor(private readonly gateway: DirectusStatsGateway) {}

  async paymentsBetween(from: Date, to: Date): Promise<PaymentPoint[]> {
    const records = await this.gateway.readPayments(from.toISOString(), to.toISOString());

    return records.map(mapPaymentPoint);
  }

  async ordersBetween(from: Date, to: Date): Promise<OrderPoint[]> {
    const records = await this.gateway.readOrders(from.toISOString(), to.toISOString());

    return records.map(mapOrderPoint);
  }

  async activeOrders(): Promise<OrderPoint[]> {
    const records = await this.gateway.readActiveOrders();

    return records.map(mapOrderPoint);
  }

  async newClientsBetween(from: Date, to: Date): Promise<number> {
    const records = await this.gateway.readClients(from.toISOString(), to.toISOString());

    return records.length;
  }
}

function mapPaymentPoint(record: DirectusPaymentPointRecord): PaymentPoint {
  if (!isPaymentMethod(record.method)) throw new Error(`Invalid payment method: ${record.method}`);

  return { amount: Money.fromEuros(Number(record.amount)), createdAt: new Date(record.date_created), method: record.method };
}

function mapOrderPoint(record: DirectusOrderPointRecord): OrderPoint {
  const total = (record.garments ?? []).reduce((sum, garment) => sum.add(Money.fromEuros(Number(garment.price ?? 0))), Money.zero());
  const paid = (record.payments ?? []).reduce((sum, payment) => sum.add(Money.fromEuros(Number(payment.amount ?? 0))), Money.zero());

  return { receivedDate: new Date(record.received_date), status: record.status, total, paid };
}
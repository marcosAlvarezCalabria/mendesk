import type { StatsProvider } from "@/application/ports/StatsProvider";
import { Money } from "@/domain/values/Money";

export type IncomeBucketSize = "hour" | "day" | "week";
export type IncomeStatsInput = { from: Date; to: Date; bucket: IncomeBucketSize };
export type IncomeBucket = { key: string; amount: Money };
export type IncomeStats = {
  from: Date;
  to: Date;
  totalIncome: Money;
  paymentsCount: number;
  ordersCreated: number;
  ordersByStatus: Record<string, number>;
  incomeBuckets: IncomeBucket[];
  incomeByMethod: { cash: Money; card: Money };
  averageOrderValue: Money;
  paidOrders: number;
  outstandingBalance: Money;
  newClients: number;
};

const DEFAULT_ORDER_STATUSES = ["received", "ready", "collected", "cancelled"] as const;
const dublinParts = new Intl.DateTimeFormat("en-IE", { timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23", weekday: "short" });

export class GetIncomeStats {
  constructor(private readonly stats: StatsProvider) {}

  async execute(input: IncomeStatsInput): Promise<IncomeStats> {
    if (input.from >= input.to) throw new Error("Invalid date range");

    const [payments, orders, activeOrders, newClients] = await Promise.all([
      this.stats.paymentsBetween(input.from, input.to),
      this.stats.ordersBetween(input.from, input.to),
      this.stats.activeOrders(),
      this.stats.newClientsBetween(input.from, input.to),
    ]);
    const totalIncome = payments.reduce((total, payment) => total.add(payment.amount), Money.zero());
    const incomeByMethod = { cash: Money.zero(), card: Money.zero() };
    for (const payment of payments) incomeByMethod[payment.method] = incomeByMethod[payment.method].add(payment.amount);
    const ordersByStatus: Record<string, number> = Object.fromEntries(DEFAULT_ORDER_STATUSES.map(status => [status, 0]));
    for (const order of orders) ordersByStatus[order.status] = (ordersByStatus[order.status] ?? 0) + 1;

    const orderValueCents = orders.reduce((total, order) => total + order.total.cents, 0);
    const averageOrderValue = Money.fromCents(orders.length === 0 ? 0 : Math.round(orderValueCents / orders.length));
    const paidOrders = orders.filter(order => order.total.cents > 0 && order.paid.cents >= order.total.cents).length;
    const outstandingBalance = activeOrders.reduce((total, order) => total.add(order.total.subtract(order.paid)), Money.zero());
    const grouped = new Map<string, Money>();
    for (const payment of payments) {
      const key = bucketKey(payment.createdAt, input.bucket);
      grouped.set(key, (grouped.get(key) ?? Money.zero()).add(payment.amount));
    }

    return {
      from: input.from,
      to: input.to,
      totalIncome,
      paymentsCount: payments.length,
      ordersCreated: orders.length,
      ordersByStatus,
      incomeBuckets: [...grouped].sort(([left], [right]) => left.localeCompare(right)).map(([key, amount]) => ({ key, amount })),
      incomeByMethod,
      averageOrderValue,
      paidOrders,
      outstandingBalance,
      newClients,
    };
  }
}

function bucketKey(date: Date, bucket: IncomeBucketSize): string {
  const parts = Object.fromEntries(dublinParts.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  const day = `${parts.year}-${parts.month}-${parts.day}`;
  if (bucket === "hour") return `${day}T${parts.hour}`;
  if (bucket === "day") return day;

  const localDay = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const mondayOffset = (localDay.getUTCDay() + 6) % 7;
  localDay.setUTCDate(localDay.getUTCDate() - mondayOffset);
  return `${localDay.getUTCFullYear()}-${two(localDay.getUTCMonth() + 1)}-${two(localDay.getUTCDate())}`;
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

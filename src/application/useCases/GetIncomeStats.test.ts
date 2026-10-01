import { describe, expect, it } from "vitest";

import type { OrderPoint, PaymentPoint, StatsProvider } from "@/application/ports/StatsProvider";
import { GetIncomeStats } from "@/application/useCases/GetIncomeStats";
import { Money } from "@/domain/values/Money";

describe("GetIncomeStats", () => {
  const from = new Date("2026-08-01T00:00:00.000Z");
  const to = new Date("2026-08-31T23:59:59.999Z");

  it("sums payments in Money and counts payments", async () => {
    const provider = new FakeStatsProvider({ payments: [payment(10), payment(20), payment(5)] });
    const stats = await new GetIncomeStats(provider).execute({ from, to, bucket: "day" });

    expect(provider.lastPaymentsRange).toEqual({ from, to });
    expect(stats.totalIncome.toString()).toBe("35.00");
    expect(stats.paymentsCount).toBe(3);
  });

  it("calculates the expanded money and workshop metrics", async () => {
    const provider = new FakeStatsProvider({
      payments: [payment(10, "cash"), payment(20, "card"), payment(5, "card")],
      orders: [order("received", 100, 40), order("ready", 50, 50), order("collected", 30, 35)],
      activeOrders: [order("received", 100, 40), order("ready", 50, 10)],
      newClients: 6,
    });

    const stats = await new GetIncomeStats(provider).execute({ from, to, bucket: "day" });

    expect(stats.incomeByMethod.cash.toString()).toBe("10.00");
    expect(stats.incomeByMethod.card.toString()).toBe("25.00");
    expect(stats.averageOrderValue.toString()).toBe("60.00");
    expect(stats.paidOrders).toBe(2);
    expect(stats.outstandingBalance.toString()).toBe("100.00");
    expect(stats.newClients).toBe(6);
    expect(provider.activeOrderReads).toBe(1);
    expect(provider.lastClientsRange).toEqual({ from, to });
  });


  it("counts created orders by current status", async () => {
    const provider = new FakeStatsProvider({ orders: [order("received"), order("received"), order("ready"), order("collected")] });
    const stats = await new GetIncomeStats(provider).execute({ from, to, bucket: "day" });

    expect(provider.lastOrdersRange).toEqual({ from, to });
    expect(stats.ordersCreated).toBe(4);
    expect(stats.ordersByStatus).toEqual({ received: 2, ready: 1, collected: 1, cancelled: 0 });
  });

  it("rejects an invalid date range before touching the provider", async () => {
    const provider = new FakeStatsProvider({});

    await expect(new GetIncomeStats(provider).execute({ from: to, to: from, bucket: "day" })).rejects.toThrow("Invalid date range");
    expect(provider.calls).toBe(0);
  });

  it("returns reconciled zero totals and an empty chart for an empty range", async () => {
    const stats = await new GetIncomeStats(new FakeStatsProvider({})).execute({ from, to, bucket: "day" });

    expect(stats.totalIncome.equals(Money.zero())).toBe(true);
    expect(stats.paymentsCount).toBe(0);
    expect(stats.ordersCreated).toBe(0);
    expect(stats.ordersByStatus).toEqual({ received: 0, ready: 0, collected: 0, cancelled: 0 });
    expect(stats.incomeBuckets).toEqual([]);
    expect(stats.incomeByMethod.cash.equals(Money.zero())).toBe(true);
    expect(stats.incomeByMethod.card.equals(Money.zero())).toBe(true);
    expect(stats.averageOrderValue.equals(Money.zero())).toBe(true);
    expect(stats.outstandingBalance.equals(Money.zero())).toBe(true);
    expect(stats.paidOrders).toBe(0);
    expect(stats.newClients).toBe(0);
  });

  it("groups payment money into Dublin day buckets that reconcile with the total", async () => {
    const provider = new FakeStatsProvider({ payments: [paymentAt(12.5, "2026-08-10T22:30:00.000Z"), paymentAt(7.25, "2026-08-10T23:30:00.000Z"), paymentAt(3, "2026-08-11T12:00:00.000Z")] });
    const stats = await new GetIncomeStats(provider).execute({ from, to, bucket: "day" });

    expect(stats.incomeBuckets.map(item => [item.key, item.amount.toString()])).toEqual([
      ["2026-08-10", "12.50"],
      ["2026-08-11", "10.25"],
    ]);
    expect(stats.incomeBuckets.reduce((sum, item) => sum + item.amount.cents, 0)).toBe(stats.totalIncome.cents);
  });

  it("anchors long-range weekly buckets on Dublin Mondays", async () => {
    const provider = new FakeStatsProvider({ payments: [paymentAt(5, "2026-08-30T23:30:00.000Z"), paymentAt(8, "2026-09-06T23:30:00.000Z")] });
    const stats = await new GetIncomeStats(provider).execute({ from, to, bucket: "week" });

    expect(stats.incomeBuckets.map(item => item.key)).toEqual(["2026-08-31", "2026-09-07"]);
  });
});

class FakeStatsProvider implements StatsProvider {
  lastPaymentsRange: { from: Date; to: Date } | null = null;
  lastOrdersRange: { from: Date; to: Date } | null = null;
  calls = 0;
  lastClientsRange: { from: Date; to: Date } | null = null;
  activeOrderReads = 0;

  constructor(private readonly data: { payments?: PaymentPoint[]; orders?: OrderPoint[]; activeOrders?: OrderPoint[]; newClients?: number }) {}

  async paymentsBetween(from: Date, to: Date): Promise<PaymentPoint[]> {
    this.calls += 1;
    this.lastPaymentsRange = { from, to };
    return this.data.payments ?? [];
  }

  async ordersBetween(from: Date, to: Date): Promise<OrderPoint[]> {
    this.calls += 1;
    this.lastOrdersRange = { from, to };
    return this.data.orders ?? [];
  }


  async activeOrders(): Promise<OrderPoint[]> {
    this.calls += 1;
    this.activeOrderReads += 1;
    return this.data.activeOrders ?? [];
  }

  async newClientsBetween(from: Date, to: Date): Promise<number> {
    this.calls += 1;
    this.lastClientsRange = { from, to };
    return this.data.newClients ?? 0;
  }
}
function payment(euros: number, method: "cash" | "card" = "cash"): PaymentPoint {
  return paymentAt(euros, "2026-08-10T10:00:00.000Z", method);
}

function paymentAt(euros: number, createdAt: string, method: "cash" | "card" = "cash"): PaymentPoint {
  return { amount: Money.fromEuros(euros), createdAt: new Date(createdAt), method };
}

function order(status: string, totalEuros = 0, paidEuros = 0): OrderPoint {
  return { receivedDate: new Date("2026-08-10T10:00:00.000Z"), status, total: Money.fromEuros(totalEuros), paid: Money.fromEuros(paidEuros) };
}

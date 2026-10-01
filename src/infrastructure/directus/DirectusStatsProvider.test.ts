import { describe, expect, it } from "vitest";

import type { DirectusClientPointRecord, DirectusOrderPointRecord, DirectusPaymentPointRecord, DirectusStatsGateway } from "@/infrastructure/directus/DirectusStatsGateway";
import { DirectusStatsProvider } from "@/infrastructure/directus/DirectusStatsProvider";

describe("DirectusStatsProvider", () => {
  const from = new Date("2026-08-01T00:00:00.000Z");
  const to = new Date("2026-08-31T23:59:59.999Z");

  it("maps payment records to PaymentPoint with Money and Date and passes ISO range to the seam", async () => {
    const gateway = new FakeDirectusStatsGateway({
      payments: [
        { amount: 10, date_created: "2026-08-10T10:00:00.000Z", method: "cash" },
        { amount: "20.50", date_created: "2026-08-11T11:15:00.000Z", method: "card" },
      ],
    });
    const provider = new DirectusStatsProvider(gateway);

    const payments = await provider.paymentsBetween(from, to);

    expect(gateway.lastPaymentsRange).toEqual({ fromIso: from.toISOString(), toIso: to.toISOString() });
    expect(payments).toHaveLength(2);
    expect(payments[0]?.amount.toString()).toBe("10.00");
    expect(payments[0]?.createdAt).toEqual(new Date("2026-08-10T10:00:00.000Z"));
    expect(payments.map(payment => payment.method)).toEqual(["cash", "card"]);
    expect(payments[1]?.amount.toString()).toBe("20.50");
  });

  it("maps order records to OrderPoint with Date and status and passes ISO range to the seam", async () => {
    const gateway = new FakeDirectusStatsGateway({
      orders: [
        { received_date: "2026-08-12T12:00:00.000Z", status: "received", garments: [{ price: 40 }, { price: "10.50" }], payments: [{ amount: 15 }] },
        { received_date: "2026-08-13T13:30:00.000Z", status: "ready", garments: [], payments: [] },
      ],
    });
    const provider = new DirectusStatsProvider(gateway);

    const orders = await provider.ordersBetween(from, to);

    expect(gateway.lastOrdersRange).toEqual({ fromIso: from.toISOString(), toIso: to.toISOString() });
    expect(orders.map(order => ({ receivedDate: order.receivedDate, status: order.status, total: order.total.toString(), paid: order.paid.toString() }))).toEqual([
      { receivedDate: new Date("2026-08-12T12:00:00.000Z"), status: "received", total: "50.50", paid: "15.00" },
      { receivedDate: new Date("2026-08-13T13:30:00.000Z"), status: "ready", total: "0.00", paid: "0.00" },
    ]);
  });

  it("maps active orders and counts new clients", async () => {
    const gateway = new FakeDirectusStatsGateway({
      activeOrders: [{ received_date: "2026-08-01T09:00:00.000Z", status: "ready", garments: [{ price: 100 }], payments: [{ amount: 40 }] }],
      clients: [{ id: "client-1" }, { id: "client-2" }],
    });
    const provider = new DirectusStatsProvider(gateway);

    const activeOrders = await provider.activeOrders();
    const newClients = await provider.newClientsBetween(from, to);

    expect(activeOrders[0]?.total.toString()).toBe("100.00");
    expect(activeOrders[0]?.paid.toString()).toBe("40.00");
    expect(newClients).toBe(2);
    expect(gateway.activeOrderReads).toBe(1);
    expect(gateway.lastClientsRange).toEqual({ fromIso: from.toISOString(), toIso: to.toISOString() });
  });
});

class FakeDirectusStatsGateway implements DirectusStatsGateway {
  lastPaymentsRange: { fromIso: string; toIso: string } | null = null;
  lastOrdersRange: { fromIso: string; toIso: string } | null = null;
  lastClientsRange: { fromIso: string; toIso: string } | null = null;
  activeOrderReads = 0;

  constructor(private readonly data: { payments?: DirectusPaymentPointRecord[]; orders?: DirectusOrderPointRecord[]; activeOrders?: DirectusOrderPointRecord[]; clients?: DirectusClientPointRecord[] }) {}

  async readPayments(fromIso: string, toIso: string): Promise<DirectusPaymentPointRecord[]> {
    this.lastPaymentsRange = { fromIso, toIso };
    return this.data.payments ?? [];
  }

  async readOrders(fromIso: string, toIso: string): Promise<DirectusOrderPointRecord[]> {
    this.lastOrdersRange = { fromIso, toIso };
    return this.data.orders ?? [];
  }
  async readActiveOrders(): Promise<DirectusOrderPointRecord[]> {
    this.activeOrderReads += 1;
    return this.data.activeOrders ?? [];
  }

  async readClients(fromIso: string, toIso: string): Promise<DirectusClientPointRecord[]> {
    this.lastClientsRange = { fromIso, toIso };
    return this.data.clients ?? [];
  }
}

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: ({ title }: { title: string }) => <header>{title}</header> }));
vi.mock("@/app/sync/ReadSyncMarker", () => ({ ReadSyncMarker: () => null }));
vi.mock("@/application/useCases/GetIncomeStats", async importOriginal => {
  const actual = await importOriginal<typeof import("@/application/useCases/GetIncomeStats")>();
  return { ...actual, GetIncomeStats: class { execute = mocks.execute; } };
});
vi.mock("@/composition/directus", () => ({ makeStatsProvider: () => ({}) }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "token" }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));

import StatsPage from "./page";
function money(euros: number) {
  return { cents: Math.round(euros * 100), toEuros: () => euros, toString: () => euros.toFixed(2) };
}

describe("StatsPage", () => {
  beforeEach(() => mocks.execute.mockReset());

  it("renders the approved money-first overview with real workshop metrics", async () => {
    mocks.execute.mockResolvedValue({
      totalIncome: money(487.5),
      paymentsCount: 7,
      ordersCreated: 4,
      ordersByStatus: { received: 1, ready: 2, collected: 1, cancelled: 0 },
      incomeBuckets: [{ key: "2026-09-13T09", amount: money(487.5) }],
      incomeByMethod: { cash: money(187.5), card: money(300) },
      averageOrderValue: money(121.88),
      paidOrders: 3,
      outstandingBalance: money(240),
      newClients: 2,
    });

    const html = renderToStaticMarkup(await StatsPage({ searchParams: Promise.resolve({ preset: "today" }) }));

    expect(html).toContain("Today");
    expect(html).toContain("This week");
    expect(html).toContain("This month");
    expect(html).toContain("More");
    expect(html).toContain("Money received");
    expect(html).toContain("€487.50");
    expect(html).toContain("Money received over time");
    expect(html).toContain("Still to collect");
    expect(html).toContain("€240.00");
    expect(html).toContain("Average order");
    expect(html).toContain("€121.88");
    expect(html).toContain("Orders paid");
    expect(html).toContain("New clients");
    expect(html).toContain("Payment methods");
    expect(html).toContain("Card · €300.00");
    expect(html).toContain("Cash · €187.50");
    expect(html).toContain("Payment method breakdown: Card €300.00, Cash €187.50");
    expect(html).not.toContain("Orders created by current status");
    expect(html).not.toContain('type="date"');
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ bucket: "hour" }));
  });

  it("reveals the required custom range only for More", async () => {
    mocks.execute.mockResolvedValue({
      totalIncome: money(0),
      paymentsCount: 0,
      ordersCreated: 0,
      ordersByStatus: { received: 0, ready: 0, collected: 0, cancelled: 0 },
      incomeBuckets: [],
      incomeByMethod: { cash: money(0), card: money(0) },
      averageOrderValue: money(0),
      paidOrders: 0,
      outstandingBalance: money(0),
      newClients: 0,
    });

    const html = renderToStaticMarkup(await StatsPage({ searchParams: Promise.resolve({ preset: "more", from: "2026-08-01", to: "2026-09-15" }) }));

    expect(html.match(/type="date"/g)).toHaveLength(2);
    expect(html).toContain("required");
    expect(html).toContain("No payments recorded in this period");
    expect(mocks.execute).toHaveBeenCalledWith(expect.objectContaining({ bucket: "week" }));
    expect(html).toContain("No payments recorded by payment method");
  });
});

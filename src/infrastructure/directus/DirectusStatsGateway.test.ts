import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDirectusStatsGateway } from "@/infrastructure/directus/DirectusStatsGateway";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  readItems: vi.fn((collection: string, query: unknown) => ({ collection, query })),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => { const client = { with: () => client, request: sdk.request }; return client; },
  rest: () => ({}),
  staticToken: () => ({}),
  readItems: sdk.readItems,
}));

describe("DirectusStatsGateway", () => {
  beforeEach(() => { vi.clearAllMocks(); sdk.request.mockResolvedValue([]); });

  it("uses an exclusive upper bound for payment and order periods", async () => {
    const gateway = createDirectusStatsGateway("https://directus.example", "token");
    await gateway.readPayments("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
    await gateway.readOrders("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");

    expect(sdk.readItems).toHaveBeenNthCalledWith(1, "payments", expect.objectContaining({ filter: { date_created: { _gte: "2026-09-01T00:00:00.000Z", _lt: "2026-10-01T00:00:00.000Z" } } }));
    expect(sdk.readItems).toHaveBeenNthCalledWith(2, "orders", expect.objectContaining({ filter: { received_date: { _gte: "2026-09-01T00:00:00.000Z", _lt: "2026-10-01T00:00:00.000Z" } } }));
  });

  it("requests payment methods, order money, active balances, and new clients", async () => {
    const gateway = createDirectusStatsGateway("https://directus.example", "token");
    await gateway.readPayments("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
    await gateway.readOrders("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");
    await gateway.readActiveOrders();
    await gateway.readClients("2026-09-01T00:00:00.000Z", "2026-10-01T00:00:00.000Z");

    expect(sdk.readItems).toHaveBeenNthCalledWith(1, "payments", expect.objectContaining({ fields: ["amount", "date_created", "method"] }));
    expect(sdk.readItems).toHaveBeenNthCalledWith(2, "orders", expect.objectContaining({
      fields: ["received_date", "status", { garments: ["price"], payments: ["amount"] }],
    }));
    expect(sdk.readItems).toHaveBeenNthCalledWith(3, "orders", expect.objectContaining({
      filter: { status: { _in: ["received", "ready"] } },
      fields: ["received_date", "status", { garments: ["price"], payments: ["amount"] }],
    }));
    expect(sdk.readItems).toHaveBeenNthCalledWith(4, "clients", expect.objectContaining({
      filter: { date_created: { _gte: "2026-09-01T00:00:00.000Z", _lt: "2026-10-01T00:00:00.000Z" } }, fields: ["id"],
    }));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDirectusOrderClient } from "@/infrastructure/directus/DirectusOrderClient";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  readItems: vi.fn((collection: string, query: unknown) => ({ collection, query })),
  readItem: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => {
    const client = {
      with: () => client,
      request: sdk.request,
    };

    return client;
  },
  rest: () => ({}),
  staticToken: () => ({}),
  readItems: sdk.readItems,
  readItem: sdk.readItem,
  createItem: sdk.createItem,
  updateItem: sdk.updateItem,
}));

describe("DirectusOrderClient listOrders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.request.mockResolvedValue([]);
  });

  it("requests a compact page with a stable order and one look-ahead record", async () => {
    const client = createDirectusOrderClient("https://directus.example", "token");

    await client.listOrders({
      page: 2,
      pageSize: 20,
      dateFilter: "all",
      search: "",
      today: new Date("2026-08-24T12:00:00.000Z"),
      sort: "received_desc",
    });

    const options = sdk.readItems.mock.calls[0]?.[1];

    expect(options).toEqual({
      fields: [
        "id",
        "order_number",
        "status",
        "due_date",
        { client: ["name"], garments: ["id", "price"], payments: ["amount"] },
      ],
      filter: {},
      limit: 21,
      offset: 20,
      sort: ["-received_date", "-id"],
    });
    expect(JSON.stringify(options)).not.toMatch(/photo|description|measurements|phone|gdpr_consent/);
  });

  it("orders by due date before pagination when urgency ordering is requested", async () => {
    const client = createDirectusOrderClient("https://directus.example", "token");

    await client.listOrders({
      page: 1,
      pageSize: 20,
      status: ["received", "ready"],
      dateFilter: "all",
      search: "",
      today: new Date("2026-08-24T12:00:00.000Z"),
      sort: "due_asc",
    });

    const options = sdk.readItems.mock.calls[0]?.[1] as { sort: string[] };

    expect(options.sort).toEqual(["due_date", "id"]);
  });

  it("sends status, overdue and text filters to Directus", async () => {
    const client = createDirectusOrderClient("https://directus.example", "token");

    await client.listOrders({
      page: 1,
      pageSize: 20,
      status: ["received", "ready"],
      dateFilter: "overdue",
      search: " Mary ",
      today: new Date("2026-08-24T12:00:00.000Z"),
      sort: "received_desc",
    });

    const options = sdk.readItems.mock.calls[0]?.[1] as { filter: unknown };

    expect(options.filter).toEqual({
      _and: [
        { status: { _in: ["received", "ready"] } },
        { due_date: { _lt: "2026-08-24T12:00:00.000Z" } },
        { status: { _eq: "received" } },
        {
          _or: [
            { order_number: { _istarts_with: "Mary" } },
            { client: { name: { _istarts_with: "Mary" } } },
          ],
        },
      ],
    });
  });

  it.each([
    ["today", "2026-08-24T00:00:00.000Z", "2026-08-25T00:00:00.000Z"],
    ["tomorrow", "2026-08-25T00:00:00.000Z", "2026-08-26T00:00:00.000Z"],
    ["this_week", "2026-08-24T00:00:00.000Z", "2026-08-31T00:00:00.000Z"],
  ] as const)("translates the %s date filter to stable UTC bounds", async (dateFilter, from, to) => {
    const client = createDirectusOrderClient("https://directus.example", "token");

    await client.listOrders({
      page: 1,
      pageSize: 20,
      dateFilter,
      search: "",
      today: new Date("2026-08-24T12:00:00.000Z"),
      sort: "received_desc",
    });

    const options = sdk.readItems.mock.calls[0]?.[1] as { filter: unknown };

    expect(options.filter).toEqual({
      _and: [{ due_date: { _gte: from, _lt: to } }],
    });
  });
});

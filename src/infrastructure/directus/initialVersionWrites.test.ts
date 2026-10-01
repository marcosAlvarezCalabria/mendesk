import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDirectusOrderClient } from "./DirectusOrderClient";
import { createDirectusGarmentGateway } from "./DirectusGarmentGateway";

const sdk = vi.hoisted(() => ({
  request: vi.fn().mockResolvedValue([]),
  updateItems: vi.fn((_collection: string, query: unknown) => query),
  deleteItems: vi.fn((_collection: string, query: unknown) => query),
}));
vi.mock("@directus/sdk", () => ({
  createDirectus: () => { const client = { with: () => client, request: sdk.request }; return client; },
  rest: vi.fn(), staticToken: vi.fn(), createItem: vi.fn(), readItem: vi.fn(), readItems: vi.fn(),
  updateItems: sdk.updateItems, deleteItems: sdk.deleteItems,
}));

type Filter = { _and?: Filter[]; _or?: Filter[] } & Record<string, unknown>;
function matches(filter: Filter, row: Record<string, unknown>): boolean {
  return Object.entries(filter).every(([key, condition]) => {
    if (key === "_and") return (condition as Filter[]).every(value => matches(value, row));
    if (key === "_or") return (condition as Filter[]).some(value => matches(value, row));
    const operation = condition as { _eq?: unknown; _null?: boolean };
    return operation._null === true ? row[key] === null : row[key] === operation._eq;
  });
}

describe("atomic initial-version writes", () => {
  beforeEach(() => vi.clearAllMocks());
  const expected = "2026-09-08T10:00:00.000Z";
  const later = "2026-09-08T10:00:01.000Z";
  it.each(["order", "status", "garment", "delete"] as const)("guards %s with id and current version including never-updated records", async kind => {
    const orders = createDirectusOrderClient("https://example.com", "test");
    const garments = createDirectusGarmentGateway("https://example.com", "test");
    if (kind === "order") await orders.updateOrder("target", expected, { due_date: later });
    if (kind === "status") await orders.updateOrderStatus("target", "received", expected, { status: "ready" });
    if (kind === "garment") await garments.updateGarment("target", expected, { description: "Test", alteration_type: "hem", price: 10 });
    if (kind === "delete") await garments.deleteGarment("target", expected);
    const command = kind === "delete" ? sdk.deleteItems : sdk.updateItems;
    const filter = (command.mock.calls[0][1] as { filter: Filter }).filter;
    const row = { id: "target", status: "received", date_created: expected, date_updated: null };
    expect(matches(filter, row)).toBe(true);
    expect(matches(filter, { ...row, id: "other" })).toBe(false);
    expect(matches(filter, { ...row, date_created: later })).toBe(false);
    expect(matches(filter, { ...row, date_updated: expected })).toBe(true);
    expect(matches(filter, { ...row, date_updated: later })).toBe(false);
    if (kind === "status") expect(matches(filter, { ...row, status: "ready" })).toBe(false);
  });
});

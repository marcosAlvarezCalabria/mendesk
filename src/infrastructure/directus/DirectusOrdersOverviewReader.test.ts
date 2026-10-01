import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDirectusOrdersOverviewReader } from "./DirectusOrdersOverviewReader";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import type { OrdersOverviewQuery } from "@/application/dtos/OrdersOverview";

const sdk = vi.hoisted(() => ({ request: vi.fn(), token: vi.fn() }));
vi.mock("@directus/sdk", () => ({
  createDirectus: () => { const client = { with: () => client, request: sdk.request }; return client; },
  staticToken: sdk.token, rest: vi.fn(), readItems: (collection: string, query: unknown) => ({ collection, query }),
}));
type Row = Record<string, unknown>;
type Command = { collection: string; query: { filter?: Row; aggregate?: unknown; fields: unknown[]; sort?: string[]; offset?: number; limit?: number } };
const query: OrdersOverviewQuery = { selection: { kind: "active" }, search: "", page: 1, now: new Date("2026-07-01T12:00:00Z") };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const order = (n: number, status = "ready", receivedDate = new Date(Date.UTC(2026, 5, 30, n)).toISOString()) => ({ id: id(n), order_number: `260907-${String(n).padStart(4, "0")}`, status, received_date: receivedDate, due_date: "2026-07-01T00:00:00Z", client: { name: "Test client" } });
function source(orders: Row[], garments: Row[] = [], payments: Row[] = [], cap = 100) {
  sdk.request.mockImplementation(async ({ collection, query: q }: Command) => {
    let rows = collection === "orders" ? orders : collection === "garments" ? garments : payments;
    rows = rows.filter(row => matches(row, q.filter ?? {}));
    if (q.aggregate) return [{ count: { id: String(rows.length) } }];
    rows = [...rows].sort((a, b) => {
      for (const sortKey of q.sort ?? []) {
        const descending = sortKey.startsWith("-");
        const key = descending ? sortKey.slice(1) : sortKey;
        const compared = String(a[key]).localeCompare(String(b[key]));
        if (compared) return descending ? -compared : compared;
      }
      return 0;
    });
    return rows.slice(q.offset ?? 0, (q.offset ?? 0) + Math.min(q.limit ?? cap, cap));
  });
}
function matches(row: Row, filter: Row): boolean {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "_and") return (value as Row[]).every(clause => matches(row, clause));
    if (key === "_or") return (value as Row[]).some(clause => matches(row, clause));
    return Object.entries(value as Row).every(([operator, expected]) => {
      const actual = row[key];
      if (operator === "_eq") return actual === expected;
      if (operator === "_in") return (expected as unknown[]).includes(actual);
      if (operator === "_lt") return new Date(actual as string).getTime() < new Date(expected as string).getTime();
      if (operator === "_gte") return new Date(actual as string).getTime() >= new Date(expected as string).getTime();
      if (operator === "_istarts_with") return String(actual).toLowerCase().startsWith(String(expected).toLowerCase());
      if (operator === "_icontains") return String(actual).toLowerCase().includes(String(expected).toLowerCase());
      if (operator === "_contains") return String(actual).includes(String(expected));
      if (Array.isArray(actual)) return actual.some(item => Boolean(item) && typeof item === "object" && matches(item as Row, { [operator]: expected }));
      if (!actual || typeof actual !== "object") return false;
      return matches(actual as Row, { [operator]: expected });
    });
  });
}
beforeEach(() => vi.clearAllMocks());
describe("Directus orders overview", () => {
  it("counts all groups with Dublin boundaries, independent of paging/search", async () => {
    source(Array.from({ length: 45 }, (_, n) => order(n)));
    const result = await createDirectusOrdersOverviewReader("https://test.invalid", "test-session").readCounts(query.now);
    expect(result).toEqual({ overdue: 0, dueToday: 0, dueTomorrow: 0, readyForPickup: 45, active: 45 });
    const calls = sdk.request.mock.calls.map(([command]) => command as Command);
    expect(calls).toHaveLength(5);
    expect(calls.every(c => c.query.aggregate && c.query.offset === undefined && c.query.limit === undefined)).toBe(true);
    expect(JSON.stringify(calls)).toContain("2026-06-30T23:00:00.000Z");
    expect(JSON.stringify(calls)).toContain("2026-07-01T23:00:00.000Z");
    expect(sdk.token).toHaveBeenCalledWith("test-session");
  });
  it.each([0, 8, 9, 20])("paginates %s orders in groups of eight without treating a server cap as exhaustion", async size => {
    source(Array.from({ length: size }, (_, n) => order(n)), [], [], 7);
    const result = await createDirectusOrdersOverviewReader("https://test.invalid", "test").readPage(query);
    expect(result.items).toHaveLength(Math.min(8, size));
    expect(result.totalCount).toBe(size); expect(result.hasNextPage).toBe(size > 8);
    const calls = sdk.request.mock.calls.map(([command]) => command as Command);
    expect(calls.find(c => c.collection === "orders" && !c.query.aggregate)?.query.sort).toEqual(["-received_date", "-id"]);
    expect(calls.find(c => c.collection === "orders" && !c.query.aggregate)?.query.fields).toContain("received_date");
    expect(JSON.stringify(calls)).not.toContain('"*"');
    expect(JSON.stringify(calls)).not.toContain('"limit":-1');
  });
  it("shows orders received today before yesterday and earlier days", async () => {
    source([
      order(1, "received", "2026-09-23T09:00:00.000Z"),
      order(2, "received", "2026-09-25T10:00:00.000Z"),
      order(3, "received", "2026-09-24T11:00:00.000Z"),
    ]);

    const result = await createDirectusOrdersOverviewReader("https://test.invalid", "test").readPage(query);

    expect(result.items.map(item => item.id)).toEqual([id(2), id(3), id(1)]);
  });

  it("matches a surname anywhere while preserving order number and garment search", async () => {
    source([]);
    await createDirectusOrdersOverviewReader("https://test.invalid", "test").readPage({ ...query, selection: { kind: "status", value: "collected" }, search: "  Connor  ", page: 2 });
    const calls = sdk.request.mock.calls.map(([command]) => command as Command);
    const pageQuery = calls.find(c => c.collection === "orders" && !c.query.aggregate)?.query;

    expect(pageQuery?.filter).toEqual({
      _and: [
        { status: { _eq: "collected" } },
        { _or: [
          { order_number: { _icontains: "Connor" } },
          { client: { name: { _icontains: "Connor" } } },
          { garments: { description: { _icontains: "Connor" } } },
        ] },
      ],
    });
    expect(pageQuery?.offset).toBe(8);
  });
  it("normalizes a telephone query without broadening text matches", async () => {
    source([]);
    await createDirectusOrdersOverviewReader("https://test.invalid", "test").readPage({ ...query, search: "00353 (85) 200-9225" });
    const calls = sdk.request.mock.calls.map(([command]) => command as Command);
    const filter = calls.find(c => c.collection === "orders" && !c.query.aggregate)?.query.filter;

    expect(filter).toEqual({
      _and: [
        { status: { _in: ["received", "ready"] } },
        { _or: [
          { order_number: { _icontains: "00353 (85) 200-9225" } },
          { client: { name: { _icontains: "00353 (85) 200-9225" } } },
          { garments: { description: { _icontains: "00353 (85) 200-9225" } } },
          { client: { phone: { _contains: "353852009225" } } },
        ] },
      ],
    });
  });
  it("includes Directus decimals padded beyond cents in the exact total", async () => {
    const rows = [order(1)];
    source(rows, [{ id: "g", order: id(1), price: "190.0000" }], [{ id: "p", order: id(1), amount: "50.0000" }]);
    const reader = createDirectusOrdersOverviewReader("https://test.invalid", "test");
    expect(await reader.readToCollect()).toEqual({ status: "ready", amountCents: 14000 });
    expect((await reader.readPage(query)).items[0]?.balance).toEqual({ status: "ready", outstandingCents: 14000, paidCents: 5000 });
    source(rows, [{ id: "g", order: id(1), price: "190.0000" }], [{ id: "p", order: id(1), amount: "50.0010" }]);
    expect(await reader.readToCollect()).toEqual({ status: "inconsistent", issues: [
      { orderId: id(1), orderNumber: "260907-0001", reason: "invalid-money" }] });
  });
  it("reads >100 ready orders and all child pages, with batch rather than per-order queries", async () => {
    const orders = Array.from({ length: 105 }, (_, n) => order(n));
    const garments = orders.flatMap((row, n) => Array.from({ length: n === 0 ? 105 : 1 }, (_, k) => ({ id: `g-${n}-${k}`, order: row.id, price: "1.01" })));
    source(orders, garments);
    const result = await createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect();
    expect(result).toEqual({ status: "ready", amountCents: 209 * 101 });
    expect(sdk.request.mock.calls.length).toBeLessThan(20);
  });
  it("identifies multiple inconsistent orders beyond the first visible page", async () => {
    const orders = Array.from({ length: 102 }, (_, n) => order(n));
    source(orders, [], [{ id: "p", order: id(101), amount: 1 }, { id: "p2", order: id(100), amount: null }]);
    const result = await createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect();
    expect(result).toEqual({ status: "inconsistent", issues: [
      { orderId: id(100), orderNumber: "260907-0100", reason: "invalid-money" },
      { orderId: id(101), orderNumber: "260907-0101", reason: "overpaid" },
    ] });
  });
  it.each([{ response: [] }, { response: [{ count: {} }] }, { response: [{ count: { id: "wrong" } }] }])("rejects invalid count %j", async ({ response }) => {
    sdk.request.mockResolvedValue(response);
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readCounts(query.now)).rejects.toThrow();
  });
  it("fails on duplicate pages instead of looping or returning a partial total", async () => {
    sdk.request.mockImplementation(async ({ collection }: Command) => collection === "orders" ? [order(1)] : []);
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect()).rejects.toThrow();
    expect(sdk.request.mock.calls.length).toBeLessThan(10);
  });
  it.each([{ status: 401 }, { errors: [{ extensions: { code: "TOKEN_EXPIRED" } }] }])("normalizes confirmed auth", async error => {
    sdk.request.mockRejectedValue(error);
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readCounts(query.now)).rejects.toThrow(InvalidCredentialsError);
  });
  it("does not classify a permission failure as logout", async () => {
    const error = { status: 403 }; sdk.request.mockRejectedValue(error);
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect()).rejects.toBe(error);
  });
  it("applies the same predicates to global counts and filtered page totals", async () => {
    const rows = [
      ...Array.from({ length: 25 }, (_, n) => ({ ...order(n, "received"), due_date: "2026-06-29T12:00:00Z" })),
      order(25, "received"), { ...order(26, "received"), due_date: "2026-07-02T12:00:00Z" },
      order(27), order(28, "collected"), order(29, "cancelled"),
    ];
    source(rows);
    const reader = createDirectusOrdersOverviewReader("https://test.invalid", "test");
    expect(await reader.readCounts(query.now)).toEqual({ overdue: 25, dueToday: 1, dueTomorrow: 1, readyForPickup: 1, active: 28 });
    for (const [value, expected] of [["overdue", 25], ["due_today", 1], ["due_tomorrow", 1], ["ready_for_pickup", 1]] as const) {
      expect((await reader.readPage({ ...query, selection: { kind: "attention", value } })).totalCount).toBe(expected);
    }
    expect((await reader.readPage({ ...query, search: "No match" })).totalCount).toBe(0);
    expect((await reader.readCounts(query.now)).active).toBe(28);
  });
  it("rereads created, paid and transitioned orders without storing an overview cache", async () => {
    const rows = [{ ...order(1, "received"), due_date: "2026-06-29T12:00:00Z" }];
    const payments: Row[] = []; source(rows, [{ id: "g", order: id(1), price: "10.00" }], payments);
    const reader = createDirectusOrdersOverviewReader("https://test.invalid", "test");
    expect((await reader.readCounts(query.now)).overdue).toBe(1);
    rows[0].status = "ready";
    expect(await reader.readCounts(query.now)).toMatchObject({ overdue: 0, readyForPickup: 1 });
    expect(await reader.readToCollect()).toEqual({ status: "ready", amountCents: 1000 });
    payments.push({ id: "p", order: id(1), amount: "2.00" });
    expect(await reader.readToCollect()).toEqual({ status: "ready", amountCents: 800 });
    expect((await reader.readPage(query)).items[0].balance).toEqual({ status: "ready", outstandingCents: 800, paidCents: 200 });
    rows[0].status = "collected";
    expect((await reader.readCounts(query.now)).active).toBe(0);
    expect(await reader.readToCollect()).toEqual({ status: "ready", amountCents: 0 });
    rows.push(order(2, "received"));
    expect((await reader.readPage(query)).items.map(row => row.id)).toEqual([id(2)]);
  });
  it("rejects foreign children and intermediate transport failures", async () => {
    sdk.request.mockImplementation(async ({ collection, query: q }: Command) => {
      if (collection === "orders") return q.offset === 0 ? [order(1)] : [];
      return [{ id: "foreign", order: id(99), price: "2.00" }];
    });
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect()).rejects.toThrow();
    source([order(1)]);
    const original = sdk.request.getMockImplementation()!;
    sdk.request.mockImplementation(command => command.collection === "orders" && command.query.offset > 0 ? Promise.reject(new Error("disconnected")) : original(command));
    await expect(createDirectusOrdersOverviewReader("https://test.invalid", "test").readToCollect()).rejects.toThrow("disconnected");
  });
});

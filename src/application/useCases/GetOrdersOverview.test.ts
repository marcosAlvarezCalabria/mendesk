import { describe, expect, it, vi } from "vitest";
import { GetOrdersOverview } from "./GetOrdersOverview";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import type { OrdersOverviewReader } from "@/application/ports/OrdersOverviewReader";
import type { OrdersOverviewQuery } from "@/application/dtos/OrdersOverview";

const query: OrdersOverviewQuery = { selection: { kind: "active" }, search: "  Ada  ", page: 1, now: new Date("2026-07-01T12:00:00Z") };
function reader(): OrdersOverviewReader {
  return {
    readCounts: vi.fn().mockResolvedValue({ overdue: 2, dueToday: 3, dueTomorrow: 4, readyForPickup: 25, active: 40 }),
    readToCollect: vi.fn().mockResolvedValue({ status: "ready", amountCents: 1200 }),
    readPage: vi.fn().mockResolvedValue({ items: [], totalCount: 0, page: 1, pageSize: 8, hasNextPage: false }),
  };
}
describe("GetOrdersOverview", () => {
  it("shares one clock and trims only list search without restricting global reads", async () => {
    const source = reader(); const result = await new GetOrdersOverview(source).execute(query);
    expect(source.readCounts).toHaveBeenCalledWith(query.now);
    expect(source.readToCollect).toHaveBeenCalledWith();
    expect(source.readPage).toHaveBeenCalledWith({ ...query, search: "Ada" });
    expect(result.asOf).toBe(query.now.toISOString());
    expect(result.counts).toEqual({ status: "ready", data: { overdue: 2, dueToday: 3, dueTomorrow: 4, readyForPickup: 25, active: 40 } });
  });
  it.each([
    { kind: "active" },
    { kind: "attention", value: "overdue" },
    { kind: "attention", value: "due_today" },
    { kind: "attention", value: "due_tomorrow" },
    { kind: "attention", value: "ready_for_pickup" },
    { kind: "status", value: "received" },
    { kind: "status", value: "ready" },
    { kind: "status", value: "collected" },
    { kind: "status", value: "cancelled" },
  ] as const)("accepts the Orders filter $kind $value", async selection => {
    const source = reader();
    await new GetOrdersOverview(source).execute({ ...query, selection });

    expect(source.readPage).toHaveBeenCalledWith({ ...query, selection, search: "Ada" });
  });
  it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects page %s before IO", async page => {
    const source = reader();
    await expect(new GetOrdersOverview(source).execute({ ...query, page })).rejects.toThrow(RangeError);
    expect(source.readCounts).not.toHaveBeenCalled();
  });
  it("rejects invalid selection and clock", async () => {
    for (const invalid of [{ ...query, now: new Date(NaN) }, { ...query, selection: { kind: "status", value: "active" } }]) {
      await expect(new GetOrdersOverview(reader()).execute(invalid as OrdersOverviewQuery)).rejects.toThrow(RangeError);
    }
  });
  it.each(["readCounts", "readToCollect", "readPage"] as const)("isolates %s errors without false zero", async method => {
    const source = reader(); vi.mocked(source[method]).mockRejectedValue(new Error("private backend detail"));
    const result = await new GetOrdersOverview(source).execute(query);
    const section = { readCounts: "counts", readToCollect: "toCollect", readPage: "list" }[method] as "counts" | "toCollect" | "list";
    expect(result[section]).toEqual({ status: "error" });
    expect(JSON.stringify(result)).not.toContain("private backend");
    expect(Object.values(result).filter(value => typeof value === "object" && value.status === "ready")).toHaveLength(2);
  });
  it.each(["readCounts", "readToCollect", "readPage"] as const)("propagates confirmed auth from %s", async method => {
    const source = reader(); vi.mocked(source[method]).mockRejectedValue(new InvalidCredentialsError());
    await expect(new GetOrdersOverview(source).execute(query)).rejects.toThrow(InvalidCredentialsError);
  });
  it("starts independent reads together", async () => {
    const source = reader(); let resolve!: (value: Awaited<ReturnType<OrdersOverviewReader["readCounts"]>>) => void;
    vi.mocked(source.readCounts).mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = new GetOrdersOverview(source).execute(query);
    expect(source.readPage).toHaveBeenCalled(); expect(source.readToCollect).toHaveBeenCalled();
    resolve({ overdue: 0, dueToday: 0, dueTomorrow: 0, readyForPickup: 0, active: 0 }); await pending;
  });
});

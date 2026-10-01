import { createDirectus, readItems, rest, staticToken } from "@directus/sdk";
import type { OrderBalanceIssue, OrdersOverviewQuery, OrdersSelection, ToCollectSummary } from "@/application/dtos/OrdersOverview";
import type { OrdersOverviewReader } from "@/application/ports/OrdersOverviewReader";
import { dublinDayRange } from "@/application/queries/ordersOverviewRules";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { isAuthError } from "@/infrastructure/auth/authError";
import { DirectusMappingError } from "./DirectusMappingError";
import { mapOrdersOverviewItem, type OrdersOverviewRecord } from "./ordersOverviewMapper";

type Row = Record<string, unknown> & { id: string };
type Filter = Record<string, unknown>;
type Query = { fields?: readonly unknown[]; filter?: Filter; aggregate?: { count: string[] }; sort?: string[]; offset?: number; limit?: number };
const HEADER_FIELDS = ["id", "order_number", "status", "received_date", "due_date", { client: ["name"] }];
const ORDERS_OVERVIEW_PAGE_SIZE = 8;

export function createDirectusOrdersOverviewReader(url: string, token: string): OrdersOverviewReader {
  const client = createDirectus(url).with(staticToken(token)).with(rest());
  async function request(collection: string, query: Query): Promise<unknown[]> {
    try {
      const result: unknown = await client.request(readItems(collection, query as never));
      if (!Array.isArray(result)) throw mappingError();
      return result;
    } catch (error) {
      if (isAuthError(error)) throw new InvalidCredentialsError();
      throw error;
    }
  }
  async function count(filter: Filter): Promise<number> {
    const rows = await request("orders", { aggregate: { count: ["id"] }, filter });
    const raw = (rows[0] as { count?: { id?: unknown } } | undefined)?.count?.id;
    if (rows.length !== 1 || (typeof raw !== "string" && typeof raw !== "number") || !/^\d+$/.test(String(raw))) throw mappingError();
    const value = Number(raw);
    if (!Number.isSafeInteger(value)) throw mappingError();
    return value;
  }
  async function batch(collection: string, query: Query, seen: Set<string>): Promise<Row[]> {
    const rows = await request(collection, query);
    if (rows.length > (query.limit ?? 100)) throw mappingError();
    return rows.map(value => {
      if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string" || !value.id || seen.has(value.id)) throw mappingError();
      seen.add(value.id);
      return value as Row;
    });
  }
  async function children(collection: "garments" | "payments", ids: string[]): Promise<Row[]> {
    if (!ids.length) return [];
    const result: Row[] = []; const seen = new Set<string>();
    for (;;) {
      const rows = await batch(collection, { fields: ["id", "order", collection === "garments" ? "price" : "amount"], filter: { order: { _in: ids } }, sort: ["id"], limit: 100, offset: result.length }, seen);
      if (!rows.length) return result;
      if (rows.some(row => typeof row.order !== "string" || !ids.includes(row.order))) throw mappingError();
      result.push(...rows);
    }
  }
  async function readChildren(ids: string[]) {
    const [garments, payments] = await Promise.all([children("garments", ids), children("payments", ids)]);
    return { garments, payments };
  }
  return {
    async readCounts(now) {
      const [overdue, dueToday, dueTomorrow, readyForPickup, active] = await Promise.all([
        count(selectionFilter({ kind: "attention", value: "overdue" }, now)),
        count(selectionFilter({ kind: "attention", value: "due_today" }, now)),
        count(selectionFilter({ kind: "attention", value: "due_tomorrow" }, now)),
        count({ status: { _eq: "ready" } }), count({ status: { _in: ["received", "ready"] } }),
      ]);
      return { overdue, dueToday, dueTomorrow, readyForPickup, active };
    },
    async readPage(query) {
      if (!Number.isSafeInteger(query.page) || query.page < 1 || !Number.isSafeInteger((query.page - 1) * ORDERS_OVERVIEW_PAGE_SIZE)) throw new RangeError("Invalid orders page");
      const filter = listFilter(query);
      const totalCount = await count(filter);
      const headers: Row[] = []; const seen = new Set<string>();
      while (headers.length < ORDERS_OVERVIEW_PAGE_SIZE + 1) {
        const rows = await batch("orders", { fields: HEADER_FIELDS, filter, sort: ["-received_date", "-id"], limit: ORDERS_OVERVIEW_PAGE_SIZE + 1 - headers.length, offset: (query.page - 1) * ORDERS_OVERVIEW_PAGE_SIZE + headers.length }, seen);
        if (!rows.length) break;
        headers.push(...rows);
      }
      const visible = headers.slice(0, ORDERS_OVERVIEW_PAGE_SIZE);
      const { garments, payments } = await readChildren(visible.map(row => row.id));
      const items = visible.map(row => mapOrdersOverviewItem({ ...row,
        garments: garments.filter(child => child.order === row.id), payments: payments.filter(child => child.order === row.id),
      } as OrdersOverviewRecord));
      return { items, totalCount, page: query.page, pageSize: ORDERS_OVERVIEW_PAGE_SIZE, hasNextPage: headers.length > ORDERS_OVERVIEW_PAGE_SIZE };
    },
    async readToCollect(): Promise<ToCollectSummary> {
      let offset = 0; let amountCents = 0;
      const issues: OrderBalanceIssue[] = []; const seen = new Set<string>();
      for (;;) {
        const rows = await batch("orders", { fields: ["id", "order_number"], filter: { status: { _eq: "ready" } }, sort: ["id"], offset, limit: 100 }, seen);
        if (!rows.length) break;
        const { garments, payments } = await readChildren(rows.map(row => row.id));
        for (const row of rows) {
          if (typeof row.order_number !== "string") throw mappingError();
          const orderNumber = OrderNumber.fromString(row.order_number).value;
          let price: number; let paid: number;
          try {
            price = sumMoney(garments.filter(child => child.order === row.id).map(child => child.price), true);
            paid = sumMoney(payments.filter(child => child.order === row.id).map(child => child.amount), false);
          } catch {
            issues.push({ orderId: row.id, orderNumber, reason: "invalid-money" }); continue;
          }
          if (paid > price) issues.push({ orderId: row.id, orderNumber, reason: "overpaid" });
          else {
            amountCents += price - paid;
            if (!Number.isSafeInteger(amountCents)) throw mappingError();
          }
        }
        offset += rows.length;
      }
      return issues.length ? { status: "inconsistent", issues } : { status: "ready", amountCents };
    },
  };
}

function mappingError(): DirectusMappingError { return new DirectusMappingError("Invalid orders overview response"); }

function selectionFilter(selection: OrdersSelection, now: Date): Filter {
  const { start, end } = dublinDayRange(now);
  if (selection.kind === "active") return { status: { _in: ["received", "ready"] } };
  if (selection.kind === "status") return { status: { _eq: selection.value } };
  if (selection.value === "ready_for_pickup") return { status: { _eq: "ready" } };
  const tomorrowEnd = selection.value === "due_tomorrow" ? dublinDayRange(end).end : end;
  return { _and: [{ status: { _eq: "received" } }, { due_date: selection.value === "overdue" ? { _lt: start.toISOString() } : selection.value === "due_tomorrow" ? { _gte: end.toISOString(), _lt: tomorrowEnd.toISOString() } : { _gte: start.toISOString(), _lt: end.toISOString() } }] };
}

function listFilter(query: OrdersOverviewQuery): Filter {
  const selection = selectionFilter(query.selection, query.now);
  const search = query.search.trim();
  if (!search) return selection;

  const phone = /^[\d\s+()-]+$/.test(search)
    ? search.replace(/\D/g, "").replace(/^00/, "")
    : "";
  const matches: Filter[] = [
    { order_number: { _icontains: search } },
    { client: { name: { _icontains: search } } },
    { garments: { description: { _icontains: search } } },
  ];
  if (phone) matches.push({ client: { phone: { _contains: phone } } });

  return { _and: [selection, { _or: matches }] };
}

// Summary reads have no client/date projection and must not fabricate a complete row.
function sumMoney(values: unknown[], nullable: boolean): number {
  let sum = BigInt(0);
  for (const value of values) {
    if (value === null && nullable) continue;
    if ((typeof value !== "number" && typeof value !== "string") || !/^\d+(?:\.\d+)?$/.test(String(value))) throw mappingError();
    const [whole, fraction = ""] = String(value).split(".");
    if (/[^0]/.test(fraction.slice(2))) throw mappingError();
    const cents = fraction.slice(0, 2).padEnd(2, "0");
    sum += BigInt(whole) * BigInt(100) + BigInt(cents);
    if (sum > BigInt(Number.MAX_SAFE_INTEGER)) throw mappingError();
  }
  return Number(sum);
}

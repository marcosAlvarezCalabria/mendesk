import { createDirectus, createItem, readItem, readItems, rest, staticToken, updateItems } from "@directus/sdk";

import type { OrderListQuery } from "@/application/ports/OrderListReader";
import { directusVersionFilter } from "./directusVersionFilter";
import type { DirectusOrderListRecord, DirectusOrderRecord } from "@/infrastructure/directus/records";

export type DirectusOrderCreatePayload = {
  order_number: string;
  idempotency_key: string;
  client: string;
  status: string;
  received_date: string;
  due_date: string;
  notes?: string;
};

export type DirectusOrderUpdatePayload = { due_date: string; notes?: string };
export type DirectusOrderStatusPayload = { status: string; collected_at?: string | null };

export interface DirectusOrderClient {
  listOrders(query: OrderListQuery): Promise<DirectusOrderListRecord[]>;
  getOrder(orderNumber: string): Promise<DirectusOrderRecord | null>;
  getOrderById(id: string): Promise<DirectusOrderRecord | null>;
  createOrder(payload: DirectusOrderCreatePayload): Promise<DirectusOrderRecord>;
  updateOrder(id: string, expectedDateUpdated: string, payload: DirectusOrderUpdatePayload): Promise<DirectusOrderRecord | null>;
  updateOrderStatus(id: string, expectedStatus: string, expectedDateUpdated: string | undefined, payload: DirectusOrderStatusPayload): Promise<DirectusOrderRecord | null>;
  getOrderByIdempotencyKey(idempotencyKey: string): Promise<DirectusOrderRecord | null>;
}

type DirectusOrderItem = Omit<DirectusOrderRecord, "client"> & {
  client: string | DirectusOrderRecord["client"];
};

type DirectusSchema = {
  orders: DirectusOrderItem[];
};

const ORDER_FIELDS = ["*", { client: ["*"], garments: ["*", "photo"], payments: ["*"] }] as const;
const ORDER_LIST_FIELDS = [
  "id",
  "order_number",
  "status",
  "due_date",
  { client: ["name"], garments: ["id", "price"], payments: ["amount"] },
] as const;

export function createDirectusOrderClient(url: string, token: string): DirectusOrderClient {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async listOrders(query: OrderListQuery) {
      const records = await client.request(
        readItems("orders", {
          fields: ORDER_LIST_FIELDS,
          filter: buildOrderListFilter(query) as never,
          limit: query.pageSize + 1,
          offset: (query.page - 1) * query.pageSize,
          sort: query.sort === "due_asc" ? ["due_date", "id"] : ["-received_date", "-id"],
        }),
      );

      return records as DirectusOrderListRecord[];
    },

    async getOrder(orderNumber: string) {
      const records = await client.request(
        readItems("orders", {
          fields: ORDER_FIELDS,
          filter: { order_number: { _eq: orderNumber } },
          limit: 1,
        }),
      );

      return (records as DirectusOrderRecord[])[0] ?? null;
    },

    async getOrderByIdempotencyKey(idempotencyKey: string) {
      const records = await client.request(
        readItems("orders", {
          fields: ORDER_FIELDS,
          filter: { idempotency_key: { _eq: idempotencyKey } },
          limit: 1,
        }),
      );

      return (records as DirectusOrderRecord[])[0] ?? null;
    },

    async getOrderById(id: string) {
      try {
        return (await client.request(readItem("orders", id, { fields: ORDER_FIELDS }))) as DirectusOrderRecord;
      } catch (error) {
        if (isDirectusNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    },

    async createOrder(payload: DirectusOrderCreatePayload) {
      return (await client.request(createItem("orders", payload))) as DirectusOrderRecord;
    },

    async updateOrder(id: string, expectedDateUpdated: string, payload: DirectusOrderUpdatePayload) {
      const records = await client.request(
        updateItems(
          "orders",
          { filter: { id: { _eq: id }, ...directusVersionFilter(expectedDateUpdated) } } as never,
          payload,
          { fields: ORDER_FIELDS },
        ),
      );

      return (records as DirectusOrderRecord[])[0] ?? null;
    },

    async updateOrderStatus(id: string, expectedStatus: string, expectedDateUpdated: string | undefined, payload: DirectusOrderStatusPayload) {
      const records = await client.request(
        updateItems(
          "orders",
          { filter: { id: { _eq: id }, status: { _eq: expectedStatus }, ...(expectedDateUpdated ? directusVersionFilter(expectedDateUpdated) : {}) } } as never,
          payload,
          { fields: ORDER_FIELDS },
        ),
      );

      return (records as DirectusOrderRecord[])[0] ?? null;
    },
  };
}

type DirectusFilterClause = Record<string, unknown>;

function buildOrderListFilter(query: OrderListQuery): DirectusFilterClause {
  const clauses: DirectusFilterClause[] = [];

  if (query.status && query.status.length > 0) {
    clauses.push({ status: { _in: [...query.status] } });
  }

  clauses.push(...buildDateFilter(query));

  const search = query.search.trim();
  if (search) {
    clauses.push({
      _or: [
        { order_number: { _istarts_with: search } },
        { client: { name: { _istarts_with: search } } },
      ],
    });
  }

  return clauses.length === 0 ? {} : { _and: clauses };
}

function buildDateFilter(query: OrderListQuery): DirectusFilterClause[] {
  if (query.dateFilter === "all") {
    return [];
  }

  if (query.dateFilter === "overdue") {
    return [
      { due_date: { _lt: query.today.toISOString() } },
      { status: { _eq: "received" } },
    ];
  }

  const today = startOfUtcDay(query.today);
  const startOffset = query.dateFilter === "tomorrow" ? 1 : 0;
  const endOffset = query.dateFilter === "this_week" ? 7 : startOffset + 1;

  return [
    {
      due_date: {
        _gte: addUtcDays(today, startOffset).toISOString(),
        _lt: addUtcDays(today, endOffset).toISOString(),
      },
    },
  ];
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function isDirectusNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "status" in error && error.status === 404;
}

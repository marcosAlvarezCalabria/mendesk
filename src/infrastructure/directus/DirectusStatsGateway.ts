import { createDirectus, readItems, rest, staticToken } from "@directus/sdk";

export type DirectusPaymentPointRecord = { amount: number | string; date_created: string; method: string };
export type DirectusOrderPointRecord = { received_date: string; status: string; garments?: { price: number | string | null }[]; payments?: { amount: number | string | null }[] };
export type DirectusClientPointRecord = { id: string };

const ORDER_MONEY_FIELDS = ["received_date", "status", { garments: ["price"], payments: ["amount"] }] as const;

export interface DirectusStatsGateway {
  readPayments(fromIso: string, toIso: string): Promise<DirectusPaymentPointRecord[]>;
  readOrders(fromIso: string, toIso: string): Promise<DirectusOrderPointRecord[]>;
  readActiveOrders(): Promise<DirectusOrderPointRecord[]>;
  readClients(fromIso: string, toIso: string): Promise<DirectusClientPointRecord[]>;
}

type DirectusSchema = { payments: DirectusPaymentPointRecord[]; orders: DirectusOrderPointRecord[]; clients: DirectusClientPointRecord[] };

export function createDirectusStatsGateway(url: string, token: string): DirectusStatsGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async readPayments(fromIso: string, toIso: string) {
      return (await client.request(readItems("payments", {
        filter: buildDateRangeFilter("date_created", fromIso, toIso),
        fields: ["amount", "date_created", "method"],
        limit: -1,
      }))) as DirectusPaymentPointRecord[];
    },
    async readOrders(fromIso: string, toIso: string) {
      return (await client.request(readItems("orders", {
        filter: buildDateRangeFilter("received_date", fromIso, toIso),
        fields: ORDER_MONEY_FIELDS,
        limit: -1,
      }))) as DirectusOrderPointRecord[];
    },
    async readActiveOrders() {
      return (await client.request(readItems("orders", {
        filter: { status: { _in: ["received", "ready"] } },
        fields: ORDER_MONEY_FIELDS,
        limit: -1,
      }))) as DirectusOrderPointRecord[];
    },
    async readClients(fromIso: string, toIso: string) {
      return (await client.request(readItems("clients", {
        filter: buildDateRangeFilter("date_created", fromIso, toIso),
        fields: ["id"],
        limit: -1,
      }))) as DirectusClientPointRecord[];
    },
  };
}

function buildDateRangeFilter(field: string, fromIso: string, toIso: string): Record<string, unknown> {
  return { [field]: { _gte: fromIso, _lt: toIso } };
}

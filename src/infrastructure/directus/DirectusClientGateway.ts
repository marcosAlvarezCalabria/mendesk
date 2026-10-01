import { createDirectus, createItem, deleteFile, readItem, readItems, rest, staticToken, updateItem } from "@directus/sdk";

import type { DirectusClientListRecord, DirectusClientRecord, DirectusOrderRecord } from "@/infrastructure/directus/records";

export type DirectusClientCreatePayload = { name: string; phone: string; gdpr_consent: boolean; notes?: string };
export type DirectusClientUpdatePayload = { name: string; phone: string | null; notes: string; gdpr_consent: boolean };
export type DirectusClientListQuery = { page: number; pageSize: number; search?: string };

export interface DirectusClientGateway {
  createClient(payload: DirectusClientCreatePayload): Promise<DirectusClientRecord | null>;
  getClientByPhone(phone: string): Promise<DirectusClientRecord | null>;
  listClients(query: DirectusClientListQuery): Promise<DirectusClientListRecord[]>;
  getClient(id: string): Promise<DirectusClientRecord | null>;
  listOrdersByClient(clientId: string): Promise<DirectusOrderRecord[]>;
  updateClient(id: string, payload: DirectusClientUpdatePayload): Promise<void>;
  deleteFile(id: string): Promise<void>;
}

type DirectusOrderItem = Omit<DirectusOrderRecord, "client"> & {
  client: string | DirectusOrderRecord["client"];
};

type DirectusFileRecord = { id: string };

type DirectusSchema = {
  clients: DirectusClientRecord[];
  orders: DirectusOrderItem[];
  directus_files: DirectusFileRecord[];
};

const ORDER_FIELDS = ["*", { client: ["*"], garments: ["*", "photo"], payments: ["*"] }] as const;

export function createDirectusClientGateway(url: string, token: string): DirectusClientGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async createClient(payload: DirectusClientCreatePayload) {
      return (await client.request(createItem("clients", payload))) as DirectusClientRecord | null;
    },


    async getClientByPhone(phone: string) {
      const records = await client.request(readItems("clients", {
        fields: ["id", "name", "phone", "gdpr_consent", "notes"],
        filter: { phone: { _eq: phone } },
        limit: 1,
      })) as DirectusClientRecord[];
      return records[0] ?? null;
    },
    async listClients(query: DirectusClientListQuery) {
      const search = query.search?.trim();
      const phone = search && /^[\d\s+()-]+$/.test(search)
        ? search.replace(/\D/g, "").replace(/^00/, "") : "";
      return (await client.request(
        readItems("clients", {
          fields: ["id", "name", "phone", "gdpr_consent"],
          filter: search ? { _and: [
            { phone: { _nnull: true } },
            { _or: [{ name: { _icontains: search } }, ...(phone ? [{ phone: { _contains: phone } }] : [])] },
          ] } : { phone: { _nnull: true } },
          sort: ["name", "id"],
          limit: query.pageSize + 1,
          offset: (query.page - 1) * query.pageSize,
        }),
      )) as DirectusClientListRecord[];
    },

    async getClient(id: string) {
      try {
        return (await client.request(readItem("clients", id))) as DirectusClientRecord;
      } catch (error) {
        if (isDirectusNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    },

    async listOrdersByClient(clientId: string) {
      return (await client.request(
        readItems("orders", {
          fields: ORDER_FIELDS,
          filter: { client: { _eq: clientId } },
          sort: ["-received_date"],
          limit: -1,
        }),
      )) as DirectusOrderRecord[];
    },

    async updateClient(id: string, payload: DirectusClientUpdatePayload) {
      await client.request(updateItem("clients", id, payload));
    },

    async deleteFile(id: string) {
      try {
        await client.request(deleteFile(id));
      } catch (error) {
        if (isDirectusNotFoundError(error)) {
          return;
        }

        throw error;
      }
    },
  };
}

function isDirectusNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  return "status" in error && error.status === 404;
}

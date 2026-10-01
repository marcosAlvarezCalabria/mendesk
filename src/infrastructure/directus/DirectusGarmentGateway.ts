import { createDirectus, createItem, deleteItems, readItems, rest, staticToken, updateItems } from "@directus/sdk";

import type { DirectusGarmentRecord } from "@/infrastructure/directus/records";
import { directusVersionFilter } from "./directusVersionFilter";

export type DirectusGarmentCreatePayload = {
  order: string;
  idempotency_key: string;
  description: string;
  alteration_type: string;
  measurements?: string;
  price: number;
  photo?: string;
};

export type DirectusGarmentUpdatePayload = {
  description: string;
  alteration_type: string;
  measurements?: string;
  price: number;
};

export interface DirectusGarmentGateway {
  createGarment(payload: DirectusGarmentCreatePayload): Promise<DirectusGarmentRecord>;
  getGarmentByIdempotencyKey(idempotencyKey: string): Promise<DirectusGarmentRecord | null>;
  updateGarment(id: string, expectedDateUpdated: string, payload: DirectusGarmentUpdatePayload): Promise<DirectusGarmentRecord | null>;
  deleteGarment(id: string, expectedDateUpdated: string): Promise<"deleted" | "conflict">;
}

type DirectusSchema = {
  garments: DirectusGarmentRecord[];
};

export function createDirectusGarmentGateway(url: string, token: string): DirectusGarmentGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async getGarmentByIdempotencyKey(idempotencyKey: string) {
      const records = await client.request(
        readItems("garments", {
          fields: ["*", "photo"],
          filter: { idempotency_key: { _eq: idempotencyKey } },
          limit: 1,
        }),
      );

      return (records as DirectusGarmentRecord[])[0] ?? null;
    },

    async createGarment(payload: DirectusGarmentCreatePayload) {
      return (await client.request(createItem("garments", payload))) as DirectusGarmentRecord;
    },

    async updateGarment(id: string, expectedDateUpdated: string, payload: DirectusGarmentUpdatePayload) {
      const records = await client.request(
        updateItems(
          "garments",
          {
            filter: {
              id: { _eq: id },
              ...directusVersionFilter(expectedDateUpdated),
            },
          },
          payload,
          { fields: ["*", "photo"] },
        ),
      );

      return (records as DirectusGarmentRecord[])[0] ?? null;
    },

    async deleteGarment(id: string, expectedDateUpdated: string) {
      await client.request(
        deleteItems(
          "garments",
          {
            filter: {
              id: { _eq: id },
              ...directusVersionFilter(expectedDateUpdated),
            },
          },
        ),
      );

      const remaining = await client.request(
        readItems("garments", {
          fields: ["id"],
          filter: { id: { _eq: id } },
          limit: 1,
        }),
      );

      return remaining.length === 0 ? "deleted" : "conflict";
    },
  };
}

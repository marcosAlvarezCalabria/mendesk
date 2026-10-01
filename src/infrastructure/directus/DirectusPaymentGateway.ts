import { createDirectus, createItem, deleteItem, readItems, rest, staticToken } from "@directus/sdk";

import type { DirectusPaymentRecord } from "@/infrastructure/directus/records";

export type DirectusPaymentCreatePayload = {
  order: string;
  idempotency_key: string;
  type: string;
  amount: number;
  method: string;
};

export interface DirectusPaymentGateway {
  createPayment(payload: DirectusPaymentCreatePayload): Promise<DirectusPaymentRecord | null>;
  getPaymentByIdempotencyKey(idempotencyKey: string): Promise<DirectusPaymentRecord | null>;
  deletePayment(paymentId: string): Promise<void>;
}

type DirectusSchema = {
  payments: DirectusPaymentRecord[];
};

export function createDirectusPaymentGateway(url: string, token: string): DirectusPaymentGateway {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async getPaymentByIdempotencyKey(idempotencyKey: string) {
      const records = await client.request(
        readItems("payments", {
          fields: ["*"],
          filter: { idempotency_key: { _eq: idempotencyKey } },
          limit: 1,
        }),
      );

      return (records as DirectusPaymentRecord[])[0] ?? null;
    },

    async createPayment(payload: DirectusPaymentCreatePayload) {
      return (await client.request(createItem("payments", payload))) as DirectusPaymentRecord | null;
    },

    async deletePayment(paymentId: string) {
      await client.request(deleteItem("payments", paymentId));
    },

  };
}

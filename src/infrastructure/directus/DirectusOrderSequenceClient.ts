import { createDirectus, createItem, rest, staticToken } from "@directus/sdk";

export interface DirectusOrderSequenceClient {
  allocateOrderSequence(): Promise<unknown>;
}

type DirectusOrderSequenceItem = {
  id: number;
};

type DirectusSchema = {
  order_sequences: DirectusOrderSequenceItem[];
};

export function createDirectusOrderSequenceClient(url: string, token: string): DirectusOrderSequenceClient {
  const client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());

  return {
    async allocateOrderSequence() {
      const record = await client.request(createItem("order_sequences", {}));

      return (record as { id?: unknown }).id;
    },
  };
}

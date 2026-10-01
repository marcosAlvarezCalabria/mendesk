import { createDirectus, rest, serverHealth } from "@directus/sdk";

export interface DirectusHealthClient {
  getServerHealth(): Promise<{ status: string }>;
}

export function createDirectusHealthClient(url: string): DirectusHealthClient {
  const client = createDirectus(url).with(rest());

  return {
    async getServerHealth() {
      const response = await client.request(serverHealth());

      return { status: normalizeHealthStatus(response) };
    },
  };
}

function normalizeHealthStatus(response: { status?: unknown } | null | undefined): string {
  return typeof response?.status === "string" ? response.status : "error";
}
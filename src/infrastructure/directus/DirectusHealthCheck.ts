import type { HealthCheck, HealthStatus } from "@/application/ports/HealthCheck";
import type { DirectusHealthClient } from "@/infrastructure/directus/DirectusHealthClient";

export class DirectusHealthCheck implements HealthCheck {
  constructor(private readonly client: DirectusHealthClient) {}

  async check(): Promise<HealthStatus> {
    try {
      const health = await this.client.getServerHealth();

      return {
        ok: health.status === "ok",
        detail: health.status,
      };
    } catch (error) {
      return {
        ok: false,
        detail: getErrorMessage(error),
      };
    }
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "Unknown error";
}
import { describe, expect, it } from "vitest";

import { DirectusHealthCheck } from "@/infrastructure/directus/DirectusHealthCheck";
import type { DirectusHealthClient } from "@/infrastructure/directus/DirectusHealthClient";

describe("DirectusHealthCheck", () => {
  it("returns ok when the Directus server status is ok", async () => {
    const healthCheck = new DirectusHealthCheck(fakeHealthClient("ok"));

    await expect(healthCheck.check()).resolves.toEqual({
      ok: true,
      detail: "ok",
    });
  });

  it("returns not ok when the Directus server status is warn", async () => {
    const healthCheck = new DirectusHealthCheck(fakeHealthClient("warn"));

    await expect(healthCheck.check()).resolves.toEqual({
      ok: false,
      detail: "warn",
    });
  });

  it("returns not ok when the Directus server status is error", async () => {
    const healthCheck = new DirectusHealthCheck(fakeHealthClient("error"));

    await expect(healthCheck.check()).resolves.toEqual({
      ok: false,
      detail: "error",
    });
  });

  it("returns not ok with the error message when the Directus client throws", async () => {
    const healthCheck = new DirectusHealthCheck({
      async getServerHealth() {
        throw new Error("network down");
      },
    });

    const result = await healthCheck.check();

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("network down");
  });
});

function fakeHealthClient(status: string): DirectusHealthClient {
  return {
    async getServerHealth() {
      return { status };
    },
  };
}

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("demo Directus runtime", () => {
  it("pins supported service versions and keeps PostgreSQL private", async () => {
    const compose = await readFile("infra/demo/compose.yaml", "utf8");

    expect(compose).toContain("directus/directus:12.4.1");
    expect(compose).toContain("postgres:18.6-alpine");
    expect(compose).toContain("postgres_data:/var/lib/postgresql");
    expect(compose).not.toContain("postgres_data:/var/lib/postgresql/data");
    expect(compose).toContain("/server/ping");
    expect(compose).not.toContain("/server/health");
    expect(compose).toContain('127.0.0.1:${DEMO_DIRECTUS_PORT:-8055}:8055');
    const postgresService = compose.slice(compose.indexOf("  postgres:"), compose.indexOf("  directus:"));
    expect(postgresService).not.toContain("\n    ports:");
    expect(compose).not.toContain("latest");
  });

  it("injects every credential from the ignored environment", async () => {
    const compose = await readFile("infra/demo/compose.yaml", "utf8");

    expect(compose).toContain("${DEMO_DIRECTUS_SECRET:");
    expect(compose).toContain("${DEMO_DIRECTUS_ADMIN_PASSWORD:");
    expect(compose).toContain("${DEMO_DIRECTUS_ADMIN_TOKEN:");
    expect(compose).toContain("${DEMO_POSTGRES_PASSWORD:");
    const passwordLines = compose.split("\n").filter((line) => line.includes("PASSWORD:"));
    expect(passwordLines).toHaveLength(3);
    expect(passwordLines.every((line) => line.includes("${DEMO_"))).toBe(true);
  });
});

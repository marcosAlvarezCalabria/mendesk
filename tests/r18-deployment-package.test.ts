import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("independent deployment package", () => {
  it("builds a standalone non-root Next.js image without environment files", () => {
    expect(read("next.config.ts")).toContain('output: "standalone"');

    const dockerfile = read("Dockerfile");
    expect(dockerfile).toContain("pnpm install --frozen-lockfile");
    expect(dockerfile).toContain("pnpm prune --prod");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain('/app/.next/standalone');
    expect(read(".dockerignore")).toContain(".env*");
  });

  it("keeps the frontend private and Directus on an external installation network", () => {
    const compose = read("infra/deploy/compose.yaml");
    expect(compose).toContain('127.0.0.1:${MENDESK_APP_PORT:-3000}:3000');
    expect(compose).toContain("external: true");
    expect(compose).toContain("MENDESK_DIRECTUS_NETWORK");
    expect(compose).toContain("http://directus:8055");
    expect(compose).not.toMatch(/password|admin_token|116\.202\.17\.37/i);
  });

  it("ships only placeholder installation configuration", () => {
    const template = read("infra/deploy/deployment.env.template");
    expect(template).toContain("https://demo.example.com");
    expect(template).not.toMatch(/^[A-Z0-9_]*(?:PASSWORD|ADMIN_TOKEN)=/im);
    expect(template).not.toContain("116.202.17.37");
  });
});

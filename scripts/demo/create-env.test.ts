import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createDemoEnvironment, writeDemoEnvironment } from "./create-env";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("demo environment", () => {
  it("uses fictional identity and independent random secrets", () => {
    let sequence = 0;
    const environment = createDemoEnvironment((size) => Buffer.alloc(size, ++sequence));
    const values = parseEnvironment(environment);

    expect(values.DEMO_DIRECTUS_ADMIN_EMAIL).toBe("admin@example.com");
    expect(values.DEMO_DIRECTUS_SECRET).toHaveLength(64);
    expect(values.DEMO_DIRECTUS_ADMIN_TOKEN).toHaveLength(64);
    expect(values.DEMO_DIRECTUS_ADMIN_PASSWORD).not.toBe(values.DEMO_POSTGRES_PASSWORD);
    expect(environment).not.toMatch(/Koko|Nika|customer|client/i);
  });

  it("creates the ignored file once and refuses to overwrite credentials", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mendesk-demo-"));
    temporaryDirectories.push(directory);
    const path = join(directory, ".env.demo");

    await writeDemoEnvironment(path);
    const original = await readFile(path, "utf8");

    await expect(writeDemoEnvironment(path)).rejects.toThrow("already exists");
    expect(await readFile(path, "utf8")).toBe(original);
  });
});

function parseEnvironment(content: string): Record<string, string> {
  return Object.fromEntries(
    content
      .split("\n")
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

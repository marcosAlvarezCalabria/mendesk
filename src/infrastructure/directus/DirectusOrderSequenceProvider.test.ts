import { describe, expect, it } from "vitest";

import type { DirectusOrderSequenceClient } from "@/infrastructure/directus/DirectusOrderSequenceClient";
import { DirectusMappingError } from "@/infrastructure/directus/DirectusMappingError";
import { DirectusOrderSequenceProvider } from "@/infrastructure/directus/DirectusOrderSequenceProvider";

describe("DirectusOrderSequenceProvider", () => {
  it("returns the positive integer allocated by Directus in one operation", async () => {
    const client = new FakeDirectusOrderSequenceClient(7);
    const provider = new DirectusOrderSequenceProvider(client);

    await expect(provider.next()).resolves.toBe(7);
    expect(client.calls).toBe(1);
  });

  it("normalizes a numeric sequence id returned as a string", async () => {
    const provider = new DirectusOrderSequenceProvider(new FakeDirectusOrderSequenceClient("8"));

    await expect(provider.next()).resolves.toBe(8);
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, "", "1.5", "not-a-sequence", null, undefined])(
    "rejects invalid allocated sequence %s",
    async (value) => {
      const provider = new DirectusOrderSequenceProvider(new FakeDirectusOrderSequenceClient(value));

      await expect(provider.next()).rejects.toThrow(DirectusMappingError);
    },
  );

  it("propagates allocation errors unchanged", async () => {
    const expected = new Error("Directus unavailable");
    const client = new FakeDirectusOrderSequenceClient(undefined, expected);
    const provider = new DirectusOrderSequenceProvider(client);

    await expect(provider.next()).rejects.toBe(expected);
    expect(client.calls).toBe(1);
  });
});

class FakeDirectusOrderSequenceClient implements DirectusOrderSequenceClient {
  calls = 0;

  constructor(
    private readonly value: unknown,
    private readonly error?: Error,
  ) {}

  async allocateOrderSequence(): Promise<unknown> {
    this.calls += 1;

    if (this.error) {
      throw this.error;
    }

    return this.value;
  }
}

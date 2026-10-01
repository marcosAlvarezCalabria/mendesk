import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDirectusOrderSequenceClient } from "@/infrastructure/directus/DirectusOrderSequenceClient";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  createItem: vi.fn((collection: string, payload: unknown) => ({ collection, payload })),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => {
    const client = {
      with: () => client,
      request: sdk.request,
    };

    return client;
  },
  createItem: sdk.createItem,
  rest: () => ({}),
  staticToken: () => ({}),
}));

describe("DirectusOrderSequenceClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allocates one sequence by creating one empty order_sequences item", async () => {
    sdk.request.mockResolvedValue({ id: 7 });
    const client = createDirectusOrderSequenceClient("https://directus.example", "token");

    await expect(client.allocateOrderSequence()).resolves.toBe(7);

    expect(sdk.createItem).toHaveBeenCalledOnce();
    expect(sdk.createItem).toHaveBeenCalledWith("order_sequences", {});
    expect(sdk.request).toHaveBeenCalledOnce();
  });

  it("returns the raw id so the provider owns normalization", async () => {
    sdk.request.mockResolvedValue({ id: "8" });
    const client = createDirectusOrderSequenceClient("https://directus.example", "token");

    await expect(client.allocateOrderSequence()).resolves.toBe("8");
  });
});

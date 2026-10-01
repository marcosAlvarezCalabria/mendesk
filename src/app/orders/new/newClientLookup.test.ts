import { describe, expect, it, vi } from "vitest";

import { lookupExistingClientByPhone } from "@/app/orders/new/newClientLookup";

describe("lookupExistingClientByPhone", () => {
  it("normalizes the phone and returns the exact existing client", async () => {
    const fetcher = vi.fn(async () => response({
      items: [
        { id: "client-1", name: "Mary Kelly", phone: "353852009225" },
      ],
      hasNextPage: false,
    }));

    await expect(lookupExistingClientByPhone("085 200 9225", fetcher)).resolves.toEqual({
      status: "match",
      client: { id: "client-1", name: "Mary Kelly", phone: "353852009225" },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/clients/search?search=353852009225",
      { cache: "no-store" },
    );
  });

  it("does not treat a partial phone result as the same client", async () => {
    const fetcher = vi.fn(async () => response({
      items: [{ id: "client-2", name: "Marie", phone: "3538520092259" }],
      hasNextPage: false,
    }));

    await expect(lookupExistingClientByPhone("353852009225", fetcher)).resolves.toEqual({ status: "available" });
  });

  it.each([
    vi.fn(async () => response({ error: "Unavailable" }, false)),
    vi.fn(async () => { throw new Error("offline"); }),
  ])("reports a lookup error instead of allowing an unchecked continuation", async (fetcher) => {
    await expect(lookupExistingClientByPhone("353852009225", fetcher)).resolves.toEqual({ status: "error" });
  });
});

function response(body: unknown, ok = true) {
  return {
    ok,
    async json() {
      return body;
    },
  };
}

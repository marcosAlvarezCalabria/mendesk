import { afterEach, describe, expect, it, vi } from "vitest";

describe("client directory SDK transport", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("performs a new read after an empty result instead of retaining it in the adapter", async () => {
    const row = { id: "test", name: "Example", phone: "353850000001", gdpr_consent: true };
    const fetch = vi.fn().mockResolvedValueOnce(Response.json({ data: [] })).mockResolvedValueOnce(Response.json({ data: [row] }));
    vi.stubGlobal("fetch", fetch);
    // The SDK captures fetch at module initialization, not at gateway construction.
    vi.resetModules();
    const { createDirectusClientGateway } = await import("./DirectusClientGateway");
    const gateway = createDirectusClientGateway("https://directus.example", "test-session");
    await expect(gateway.listClients({ page: 1, pageSize: 20 })).resolves.toEqual([]);
    await expect(gateway.listClients({ page: 1, pageSize: 20 })).resolves.toEqual([row]);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) {
      const url = new URL(call[0]);
      expect(url.pathname).toBe("/items/clients");
      expect(JSON.parse(url.searchParams.get("filter")!)).toEqual({ phone: { _nnull: true } });
      expect(url.searchParams.get("offset")).toBe("0");
    }
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

describe("createDirectusAuthClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the supplied refresh token explicitly in JSON mode", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: { access_token: "new-access", refresh_token: "new-refresh", expires: 900_000 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { createDirectusAuthClient } = await import("./DirectusAuthClient");

    await expect(createDirectusAuthClient("https://directus.example").refresh("stored-refresh")).resolves.toEqual({
      access_token: "new-access",
      refresh_token: "new-refresh",
      expires: 900_000,
    });

    const [, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(request.body))).toEqual({ mode: "json", refresh_token: "stored-refresh" });
  });
});

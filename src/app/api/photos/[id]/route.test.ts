import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.fn();
let sessionToken: string | undefined;

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => (sessionToken ? { value: sessionToken } : undefined),
    set: cookieSet,
  }),
}));

describe("/api/photos/[id]", () => {
  beforeEach(() => {
    sessionToken = "token";
    cookieSet.mockClear();
    vi.stubEnv("DIRECTUS_URL", "https://directus.test");
  });

  it("proxies a private Directus photo for an authenticated request", async () => {
    const { GET } = await import("./route");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("image-bytes", {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("https://panel.test/api/photos/file-1"), {
      params: Promise.resolve({ id: "file-1" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    await expect(response.text()).resolves.toBe("image-bytes");
    expect(fetchMock).toHaveBeenCalledWith("https://directus.test/assets/file-1", {
      headers: { Authorization: "Bearer token" },
    });
  });

  it("clears the session and returns unauthorized when Directus rejects the token", async () => {
    const { GET } = await import("./route");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));

    const response = await GET(new Request("https://panel.test/api/photos/file-1"), {
      params: Promise.resolve({ id: "file-1" }),
    });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
    expect(cookieSet).toHaveBeenCalledWith(
      "koko_session",
      "",
      expect.objectContaining({ maxAge: 0 }),
    );
  });
});

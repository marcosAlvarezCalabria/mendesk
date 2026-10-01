import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isAuthError: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("@/composition/directus", () => ({ makeAuthService: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));

import { middleware } from "./middleware";

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isAuthError.mockReturnValue(false);
  });

  it("sends a request without either session token to login with its pathname and query", async () => {
    const request = new NextRequest(
      "https://panel.kokoatelier.ie/orders/260819-0142?from=ready&page=2",
    );

    const response = await middleware(request);

    expect(response.headers.get("location")).toBe(
      "https://panel.kokoatelier.ie/login?next=%2Forders%2F260819-0142%3Ffrom%3Dready%26page%3D2",
    );
  });

  it("allows a request with a session cookie to continue", async () => {
    const request = new NextRequest("https://panel.kokoatelier.ie/orders/260819-0142", {
      headers: { cookie: "koko_session=session-token" },
    });

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renews an access token that is about to expire before opening the route", async () => {
    mocks.refresh.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 900_000,
    });
    const expiringAccess = jwtExpiringAt(Date.now() + 30_000);
    const request = new NextRequest("https://panel.kokoatelier.ie/stats?preset=today", {
      headers: { cookie: `koko_session=${expiringAccess}; koko_refresh=stored-refresh` },
    });

    const response = await middleware(request);

    expect(mocks.refresh).toHaveBeenCalledWith("stored-refresh");
    expect(response.headers.get("location")).toBe(
      "https://panel.kokoatelier.ie/stats?preset=today",
    );
  });

  it("renews a refresh-only session and returns to the exact protected URL", async () => {
    mocks.refresh.mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      expiresIn: 900_000,
    });
    const request = new NextRequest(
      "https://panel.kokoatelier.ie/orders/260819-0142?returnTo=%2Forders%3Fselection%3Dready",
      { headers: { cookie: "koko_refresh=stored-refresh" } },
    );

    const response = await middleware(request);

    expect(mocks.refresh).toHaveBeenCalledWith("stored-refresh");
    expect(response.headers.get("location")).toBe(
      "https://panel.kokoatelier.ie/orders/260819-0142?returnTo=%2Forders%3Fselection%3Dready",
    );
    expect(response.cookies.get("koko_session")?.value).toBe("new-access");
    expect(response.cookies.get("koko_refresh")?.value).toBe("new-refresh");
  });

  it("keeps a transient refresh failure on the requested URL and preserves the session", async () => {
    mocks.refresh.mockRejectedValue(new TypeError("fetch failed"));
    const request = new NextRequest("https://panel.kokoatelier.ie/orders?selection=tomorrow", {
      headers: { cookie: "koko_refresh=stored-refresh" },
    });

    const response = await middleware(request);

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://panel.kokoatelier.ie/offline");
    expect(response.cookies.get("koko_refresh")).toBeUndefined();
  });

  it("opens login only when Directus confirms that the refresh session is invalid", async () => {
    mocks.refresh.mockRejectedValue({ response: { status: 401 } });
    mocks.isAuthError.mockReturnValue(true);
    const request = new NextRequest("https://panel.kokoatelier.ie/clients?page=2", {
      headers: { cookie: "koko_refresh=expired-refresh" },
    });

    const response = await middleware(request);

    expect(mocks.refresh).toHaveBeenCalledWith("expired-refresh");
    expect(response.headers.get("location")).toBe(
      "https://panel.kokoatelier.ie/login?next=%2Fclients%3Fpage%3D2",
    );
  });
});

function jwtExpiringAt(timestamp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(timestamp / 1000) })).toString("base64url");
  return `header.${payload}.signature`;
}

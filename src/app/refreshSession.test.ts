import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  getRefreshToken: vi.fn(),
  getSessionToken: vi.fn(),
  isAuthError: vi.fn(),
  refresh: vi.fn(),
  setSessionCookies: vi.fn(),
}));

vi.mock("@/composition/directus", () => ({ makeAuthService: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/infrastructure/auth/authError", () => ({ isAuthError: mocks.isAuthError }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({
  clearSessionCookie: mocks.clearSessionCookie,
  getRefreshToken: mocks.getRefreshToken,
  getSessionToken: mocks.getSessionToken,
  setSessionCookies: mocks.setSessionCookies,
}));

import { getOrRefreshSessionToken } from "./refreshSession";

describe("getOrRefreshSessionToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the current access token without refreshing", async () => {
    mocks.getSessionToken.mockResolvedValue("access");
    await expect(getOrRefreshSessionToken()).resolves.toBe("access");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("renews and stores the session when only the refresh token remains", async () => {
    const session = { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900_000 };
    mocks.getSessionToken.mockResolvedValue(undefined);
    mocks.getRefreshToken.mockResolvedValue("refresh");
    mocks.refresh.mockResolvedValue(session);

    await expect(getOrRefreshSessionToken()).resolves.toBe("new-access");
    expect(mocks.setSessionCookies).toHaveBeenCalledWith(session);
  });

  it("renews a JWT that could expire during a multi-write operation", async () => {
    const accessToken = jwtExpiringAt(Date.now() + 30_000);
    const session = { accessToken: "new-access", refreshToken: "new-refresh", expiresIn: 900_000 };
    mocks.getSessionToken.mockResolvedValue(accessToken);
    mocks.getRefreshToken.mockResolvedValue("refresh");
    mocks.refresh.mockResolvedValue(session);

    await expect(getOrRefreshSessionToken()).resolves.toBe("new-access");
    expect(mocks.refresh).toHaveBeenCalledWith("refresh");
    expect(mocks.setSessionCookies).toHaveBeenCalledWith(session);
  });

  it("clears an invalid refresh session and reports no token", async () => {
    const error = { status: 401 };
    mocks.getSessionToken.mockResolvedValue(undefined);
    mocks.getRefreshToken.mockResolvedValue("expired-refresh");
    mocks.refresh.mockRejectedValue(error);
    mocks.isAuthError.mockReturnValue(true);

    await expect(getOrRefreshSessionToken()).resolves.toBeUndefined();
    expect(mocks.clearSessionCookie).toHaveBeenCalledOnce();
  });
});

function jwtExpiringAt(timestamp: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(timestamp / 1000) })).toString("base64url");
  return `header.${payload}.signature`;
}

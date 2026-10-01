import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ clearSessionCookie: mocks.clearSessionCookie }));

import { redirectToLoginForAuthError } from "@/app/authRedirect";

describe("redirectToLoginForAuthError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("clears an expired session and carries the safe destination to login", async () => {
    await expect(
      redirectToLoginForAuthError({ status: 401 }, "/orders/260819-0142?from=qr"),
    ).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.clearSessionCookie).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Forders%2F260819-0142%3Ffrom%3Dqr");
  });

  it("uses the orders fallback when the requested destination is unsafe", async () => {
    await expect(redirectToLoginForAuthError({ status: 401 }, "//evil.example")).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/login?next=%2Forders");
  });

  it("preserves non-authentication errors without clearing the session", async () => {
    const networkError = new TypeError("fetch failed");

    await expect(redirectToLoginForAuthError(networkError, "/orders/260819-0142")).rejects.toBe(networkError);
    expect(mocks.clearSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

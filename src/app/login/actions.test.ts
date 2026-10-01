import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  redirect: vi.fn(),
  setSessionCookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/composition/directus", () => ({ makeAuthService: () => ({ login: mocks.login }) }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ setSessionCookies: mocks.setSessionCookies }));

import { loginAction } from "@/app/login/actions";
import { InvalidCredentialsError } from "@/domain/errors/InvalidCredentialsError";

describe("loginAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.login.mockResolvedValue({ accessToken: "token", refreshToken: "refresh-token", expiresIn: 900_000 });
    mocks.redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  it("returns to the safe deep link after Directus confirms the session", async () => {
    await expect(loginAction({ error: null }, loginFormData("/orders/260819-0142?from=qr"))).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(mocks.setSessionCookies).toHaveBeenCalledWith({ accessToken: "token", refreshToken: "refresh-token", expiresIn: 900_000 });
    expect(mocks.redirect).toHaveBeenCalledWith("/orders/260819-0142?from=qr");
  });

  it("preserves an encoded return path inside a safe order deep link", async () => {
    const nextPath = "/orders/260819-0142?returnTo=%2Forders";

    await expect(loginAction({ error: null }, loginFormData(nextPath))).rejects.toThrow("NEXT_REDIRECT");

    expect(mocks.redirect).toHaveBeenCalledWith(nextPath);
  });

  it.each([undefined, "https://evil.example/orders/260819-0142", "/login", "/orders%2F260819-0142"])(
    "falls back to orders for an absent or unsafe next value",
    async (nextPath) => {
      await expect(loginAction({ error: null }, loginFormData(nextPath))).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.redirect).toHaveBeenCalledWith("/orders");
    },
  );

  it("keeps invalid credentials recoverable without setting a session", async () => {
    mocks.login.mockRejectedValue(new InvalidCredentialsError());

    await expect(loginAction({ error: null }, loginFormData("/orders/260819-0142"))).resolves.toEqual({
      error: "Invalid email or password",
    });
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("preserves a network failure for the route error boundary", async () => {
    const networkError = new TypeError("fetch failed");
    mocks.login.mockRejectedValue(networkError);

    await expect(loginAction({ error: null }, loginFormData("/orders/260819-0142"))).rejects.toBe(networkError);
    expect(mocks.setSessionCookies).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

function loginFormData(nextPath: string | undefined): FormData {
  const formData = new FormData();
  formData.set("email", "user@example.com");
  formData.set("password", "secret");
  if (nextPath !== undefined) formData.set("next", nextPath);
  return formData;
}

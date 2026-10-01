import { describe, expect, it } from "vitest";

import { buildRefreshCookieOptions, buildSessionCookieOptions } from "@/infrastructure/auth/sessionCookie";

describe("buildSessionCookieOptions", () => {
  it("builds httpOnly lax cookie options with maxAge in seconds", () => {
    const options = buildSessionCookieOptions(900000);

    expect(options.maxAge).toBe(900);
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  it("keeps zero expiry at zero maxAge", () => {
    expect(buildSessionCookieOptions(0).maxAge).toBe(0);
  });

  it("rounds maxAge down when expiresIn is not divisible by one second", () => {
    expect(buildSessionCookieOptions(1500).maxAge).toBe(1);
  });

  it("keeps the refresh token in a browser-session httpOnly cookie", () => {
    expect(buildRefreshCookieOptions()).toEqual({
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
    });
  });
});

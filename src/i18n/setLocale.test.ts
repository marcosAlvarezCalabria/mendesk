import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: mocks.refresh }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.setCookie }) }));

import { setLocale } from "@/i18n/setLocale";

describe("setLocale", () => {
  beforeEach(() => {
    mocks.refresh.mockClear();
    mocks.setCookie.mockClear();
  });

  it("stores a valid locale and refreshes the current React tree in the same action", async () => {
    await setLocale("uk");

    expect(mocks.setCookie).toHaveBeenCalledWith("mendesk_locale", "uk", {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("ignores invalid locales without refreshing", async () => {
    await setLocale("fr");

    expect(mocks.setCookie).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

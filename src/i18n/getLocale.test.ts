import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ locale: undefined as string | undefined }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => mocks.locale ? { value: mocks.locale } : undefined }),
}));
vi.mock("@/config/currentStore", () => ({
  storeConfig: { localization: { locales: ["es"], defaultLocale: "es" } },
}));

import { getLocale } from "@/i18n/getLocale";

describe("getLocale", () => {
  beforeEach(() => {
    mocks.locale = undefined;
  });

  it("returns a saved locale enabled for the installation", async () => {
    mocks.locale = "es";

    await expect(getLocale()).resolves.toBe("es");
  });

  it("uses the installation default when the cookie locale is disabled", async () => {
    mocks.locale = "en";

    await expect(getLocale()).resolves.toBe("es");
  });

  it("uses the installation default when no locale cookie exists", async () => {
    await expect(getLocale()).resolves.toBe("es");
  });
});

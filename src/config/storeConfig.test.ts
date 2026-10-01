import { describe, expect, it } from "vitest";

import {
  loadStoreConfig,
  StoreConfigError,
  type StoreConfigEnvironment,
} from "@/config/storeConfig";

const validEnvironment: StoreConfigEnvironment = {
  MENDESK_STORE_ID: "demo-atelier",
  MENDESK_STORE_NAME: "Demo Atelier",
  MENDESK_STORE_SHORT_NAME: "Demo",
  MENDESK_STORE_LOGO_PATH: "/store/logo.svg",
  MENDESK_STORE_PANEL_URL: "https://demo.mendesk.example/",
  MENDESK_STORE_REVIEW_URL: "https://example.com/review",
  MENDESK_STORE_LOCALES: "en,uk",
  MENDESK_STORE_DEFAULT_LOCALE: "en",
  MENDESK_STORE_TIME_ZONE: "Europe/Dublin",
  MENDESK_STORE_CURRENCY: "EUR",
  MENDESK_STORE_CALLING_CODE: "353",
};

describe("loadStoreConfig", () => {
  it("creates an immutable installation configuration from explicit values", () => {
    const config = loadStoreConfig(validEnvironment);

    expect(config).toEqual({
      id: "demo-atelier",
      identity: {
        name: "Demo Atelier",
        shortName: "Demo",
        logo: { src: "/store/logo.svg", alt: "Demo Atelier" },
      },
      localization: {
        locales: ["en", "uk"],
        defaultLocale: "en",
        timeZone: "Europe/Dublin",
        currency: "EUR",
        defaultCallingCode: "353",
      },
      urls: {
        panelBaseUrl: "https://demo.mendesk.example",
        reviewUrl: "https://example.com/review",
      },
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.identity)).toBe(true);
    expect(Object.isFrozen(config.localization.locales)).toBe(true);
  });

  it("allows the optional review URL to be omitted", () => {
    const config = loadStoreConfig({
      ...validEnvironment,
      MENDESK_STORE_REVIEW_URL: undefined,
    });

    expect(config.urls.reviewUrl).toBeUndefined();
  });

  it.each([
    ["missing store id", { MENDESK_STORE_ID: undefined }],
    ["unsafe store id", { MENDESK_STORE_ID: "Demo Atelier" }],
    ["missing name", { MENDESK_STORE_NAME: " " }],
    ["non-rooted logo", { MENDESK_STORE_LOGO_PATH: "logo.svg" }],
    ["invalid panel URL", { MENDESK_STORE_PANEL_URL: "demo.local" }],
    ["panel URL with credentials", { MENDESK_STORE_PANEL_URL: "https://user:pass@example.com" }],
    ["unsupported locale", { MENDESK_STORE_LOCALES: "en,es" }],
    ["default locale outside locale set", { MENDESK_STORE_LOCALES: "uk", MENDESK_STORE_DEFAULT_LOCALE: "en" }],
    ["invalid time zone", { MENDESK_STORE_TIME_ZONE: "Workshop/Local" }],
    ["invalid currency", { MENDESK_STORE_CURRENCY: "euro" }],
    ["invalid calling code", { MENDESK_STORE_CALLING_CODE: "+353" }],
  ])("rejects %s", (_label, overrides) => {
    expect(() => loadStoreConfig({ ...validEnvironment, ...overrides })).toThrow(StoreConfigError);
  });
});

import { describe, expect, it } from "vitest";

import { resolveStoreConfig } from "@/config/currentStore";

describe("resolveStoreConfig", () => {
  it("uses a neutral fictional shop when no installation values are supplied", () => {
    const config = resolveStoreConfig({});

    expect(config.id).toBe("demo-atelier");
    expect(config.identity).toEqual({
      name: "Demo Atelier",
      shortName: "Demo",
      logo: { src: "/store/demo-atelier-mark.svg", alt: "Demo Atelier" },
    });
    expect(config.urls.panelBaseUrl).toBe("http://localhost:3000");
    expect(config.urls.reviewUrl).toBeUndefined();
  });

  it("allows an installation to replace every non-secret demo value", () => {
    const config = resolveStoreConfig({
      MENDESK_STORE_ID: "oak-thread",
      MENDESK_STORE_NAME: "Oak & Thread",
      MENDESK_STORE_SHORT_NAME: "Oak",
      MENDESK_STORE_LOGO_PATH: "/store/oak.svg",
      MENDESK_STORE_PANEL_URL: "https://panel.oak.example",
      MENDESK_STORE_REVIEW_URL: "https://oak.example/review",
      MENDESK_STORE_LOCALES: "en",
      MENDESK_STORE_DEFAULT_LOCALE: "en",
      MENDESK_STORE_TIME_ZONE: "Europe/London",
      MENDESK_STORE_CURRENCY: "GBP",
      MENDESK_STORE_CALLING_CODE: "44",
    });

    expect(config.id).toBe("oak-thread");
    expect(config.identity.name).toBe("Oak & Thread");
    expect(config.localization).toMatchObject({
      locales: ["en"],
      timeZone: "Europe/London",
      currency: "GBP",
      defaultCallingCode: "44",
    });
    expect(config.urls.reviewUrl).toBe("https://oak.example/review");
  });
});

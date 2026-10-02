import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreConfig } from "@/config/storeConfig";
import { DirectusShopProfileRepository } from "@/infrastructure/directus/DirectusShopProfileRepository";

const sdk = vi.hoisted(() => ({
  request: vi.fn(),
  readSingleton: vi.fn((collection: string) => ({ operation: "read", collection })),
  updateSingleton: vi.fn((collection: string, payload: unknown) => ({ operation: "update", collection, payload })),
  createItem: vi.fn((collection: string, payload: unknown) => ({ operation: "create", collection, payload })),
}));

vi.mock("@directus/sdk", () => ({
  createDirectus: () => {
    const client = { with: () => client, request: sdk.request };
    return client;
  },
  createItem: sdk.createItem,
  readSingleton: sdk.readSingleton,
  rest: () => ({}),
  staticToken: () => ({}),
  updateSingleton: sdk.updateSingleton,
}));

const baseline: StoreConfig = {
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
};

const profile = {
  name: "Atelier Aurora",
  contactEmail: "hola@atelieraurora.example",
  contactPhone: "+353 85 123 4567",
  address: "24 Camden Street Lower, Dublin 2, Ireland",
};

describe("DirectusShopProfileRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a singleton with the required installation fields when Directus returns an empty virtual record", async () => {
    sdk.request.mockResolvedValueOnce({ id: null }).mockResolvedValueOnce({ id: 1 });
    const repository = new DirectusShopProfileRepository("https://directus.example", "token", baseline);

    await repository.complete(profile);

    expect(sdk.updateSingleton).not.toHaveBeenCalled();
    expect(sdk.createItem).toHaveBeenCalledWith("shop_settings", expect.objectContaining({
      store_id: "demo-atelier",
      name: "Atelier Aurora",
      short_name: "Demo",
      panel_url: "https://demo.mendesk.example",
      locales: ["en", "uk"],
      default_locale: "en",
      time_zone: "Europe/Dublin",
      currency: "EUR",
      calling_code: "353",
      contact_email: "hola@atelieraurora.example",
      contact_phone: "+353 85 123 4567",
    }));
  });

  it("updates an existing singleton without replacing its installation fields", async () => {
    sdk.request.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 1 });
    const repository = new DirectusShopProfileRepository("https://directus.example", "token", baseline);

    await repository.complete(profile);

    expect(sdk.createItem).not.toHaveBeenCalled();
    expect(sdk.updateSingleton).toHaveBeenCalledWith("shop_settings", expect.objectContaining({
      name: "Atelier Aurora",
      contact_email: "hola@atelieraurora.example",
      contact_phone: "+353 85 123 4567",
    }));
  });
});

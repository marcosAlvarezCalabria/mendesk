import { createDirectus, readSingleton, rest, staticToken, updateSingleton } from "@directus/sdk";
import type { ShopProfileRepository } from "@/application/ports/ShopProfileRepository";
import type { StoreConfig } from "@/config/storeConfig";
import type { ShopProfile } from "@/domain/entities/ShopProfile";

type ShopSettingsRecord = {
  id?: number;
  store_id: string;
  name: string;
  short_name: string;
  panel_url: string;
  review_url?: string | null;
  locales: string[];
  default_locale: string;
  time_zone: string;
  currency: string;
  calling_code: string;
  contact_email?: string | null;
  contact_phone?: string | null;
  whatsapp_number?: string | null;
  address?: string | null;
  setup_completed_at?: string | null;
};

type DirectusSchema = { shop_settings: ShopSettingsRecord };

export class DirectusShopProfileRepository implements ShopProfileRepository {
  private readonly client;

  constructor(url: string, token: string, private readonly baseline: StoreConfig) {
    this.client = createDirectus<DirectusSchema>(url).with(staticToken(token)).with(rest());
  }

  async get(): Promise<ShopProfile | null> {
    const record = await this.readRecord();
    if (!record?.contact_email || !record.contact_phone) return null;
    return {
      name: record.name,
      contactEmail: record.contact_email,
      contactPhone: record.contact_phone,
      ...(record.whatsapp_number ? { whatsappNumber: record.whatsapp_number } : {}),
      ...(record.address ? { address: record.address } : {}),
      ...(record.setup_completed_at ? { setupCompletedAt: record.setup_completed_at } : {}),
    };
  }

  private async readRecord(): Promise<ShopSettingsRecord | null> {
    try {
      return await this.client.request(readSingleton("shop_settings"));
    } catch (error) {
      if (statusOf(error) === 404) return null;
      throw error;
    }
  }

  async complete(profile: Omit<ShopProfile, "setupCompletedAt">): Promise<void> {
    const completed = new Date().toISOString();
    const values = {
      name: profile.name,
      contact_email: profile.contactEmail,
      contact_phone: profile.contactPhone,
      whatsapp_number: profile.whatsappNumber ?? profile.contactPhone,
      address: profile.address ?? null,
      setup_completed_at: completed,
    };
    const current = await this.readRecord();
    if (current?.id != null) {
      await this.client.request(updateSingleton("shop_settings", values));
      return;
    }
    await this.client.request(updateSingleton("shop_settings", {
      ...values,
      store_id: this.baseline.id,
      short_name: this.baseline.identity.shortName,
      panel_url: this.baseline.urls.panelBaseUrl,
      review_url: this.baseline.urls.reviewUrl ?? null,
      locales: [...this.baseline.localization.locales],
      default_locale: this.baseline.localization.defaultLocale,
      time_zone: this.baseline.localization.timeZone,
      currency: this.baseline.localization.currency,
      calling_code: this.baseline.localization.defaultCallingCode,
    }));
  }
}

function statusOf(error: unknown): number | undefined {
  return typeof error === "object" && error !== null && "response" in error
    ? (error as { response?: { status?: number } }).response?.status
    : undefined;
}

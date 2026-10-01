export const supportedStoreLocales = ["en", "uk"] as const;

export type StoreLocale = (typeof supportedStoreLocales)[number];

export type StoreConfigEnvironment = Readonly<{
  MENDESK_STORE_ID?: string;
  MENDESK_STORE_NAME?: string;
  MENDESK_STORE_SHORT_NAME?: string;
  MENDESK_STORE_LOGO_PATH?: string;
  MENDESK_STORE_PANEL_URL?: string;
  MENDESK_STORE_REVIEW_URL?: string;
  MENDESK_STORE_LOCALES?: string;
  MENDESK_STORE_DEFAULT_LOCALE?: string;
  MENDESK_STORE_TIME_ZONE?: string;
  MENDESK_STORE_CURRENCY?: string;
  MENDESK_STORE_CALLING_CODE?: string;
}>;

export type StoreConfig = Readonly<{
  id: string;
  identity: Readonly<{
    name: string;
    shortName: string;
    logo: Readonly<{ src: string; alt: string }>;
  }>;
  localization: Readonly<{
    locales: readonly StoreLocale[];
    defaultLocale: StoreLocale;
    timeZone: string;
    currency: string;
    defaultCallingCode: string;
  }>;
  urls: Readonly<{
    panelBaseUrl: string;
    reviewUrl?: string;
  }>;
}>;

export class StoreConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreConfigError";
  }
}

export function loadStoreConfig(environment: StoreConfigEnvironment): StoreConfig {
  const id = required(environment.MENDESK_STORE_ID, "MENDESK_STORE_ID");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new StoreConfigError("MENDESK_STORE_ID must be a lowercase slug");
  }

  const name = required(environment.MENDESK_STORE_NAME, "MENDESK_STORE_NAME");
  const shortName = required(environment.MENDESK_STORE_SHORT_NAME, "MENDESK_STORE_SHORT_NAME");
  const logoPath = required(environment.MENDESK_STORE_LOGO_PATH, "MENDESK_STORE_LOGO_PATH");
  if (!/^\/(?!\/)[A-Za-z0-9/_\-.]+$/.test(logoPath) || logoPath.includes("..")) {
    throw new StoreConfigError("MENDESK_STORE_LOGO_PATH must be a safe root-relative path");
  }

  const locales = parseLocales(required(environment.MENDESK_STORE_LOCALES, "MENDESK_STORE_LOCALES"));
  const defaultLocale = parseLocale(
    required(environment.MENDESK_STORE_DEFAULT_LOCALE, "MENDESK_STORE_DEFAULT_LOCALE"),
    "MENDESK_STORE_DEFAULT_LOCALE",
  );
  if (!locales.includes(defaultLocale)) {
    throw new StoreConfigError("MENDESK_STORE_DEFAULT_LOCALE must be included in MENDESK_STORE_LOCALES");
  }

  const timeZone = required(environment.MENDESK_STORE_TIME_ZONE, "MENDESK_STORE_TIME_ZONE");
  assertTimeZone(timeZone);

  const currency = required(environment.MENDESK_STORE_CURRENCY, "MENDESK_STORE_CURRENCY");
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new StoreConfigError("MENDESK_STORE_CURRENCY must be a three-letter uppercase currency code");
  }

  const defaultCallingCode = required(environment.MENDESK_STORE_CALLING_CODE, "MENDESK_STORE_CALLING_CODE");
  if (!/^[1-9]\d{0,3}$/.test(defaultCallingCode)) {
    throw new StoreConfigError("MENDESK_STORE_CALLING_CODE must contain one to four digits without + or 00");
  }

  const panelBaseUrl = parseWebUrl(
    required(environment.MENDESK_STORE_PANEL_URL, "MENDESK_STORE_PANEL_URL"),
    "MENDESK_STORE_PANEL_URL",
  );
  const reviewUrl = optional(environment.MENDESK_STORE_REVIEW_URL);

  const localization = Object.freeze({
    locales: Object.freeze([...locales]),
    defaultLocale,
    timeZone,
    currency,
    defaultCallingCode,
  });
  const identity = Object.freeze({
    name,
    shortName,
    logo: Object.freeze({ src: logoPath, alt: name }),
  });
  const urls = Object.freeze({
    panelBaseUrl,
    ...(reviewUrl ? { reviewUrl: parseWebUrl(reviewUrl, "MENDESK_STORE_REVIEW_URL") } : {}),
  });

  return Object.freeze({ id, identity, localization, urls });
}

function required(value: string | undefined, key: string): string {
  const normalized = optional(value);
  if (!normalized) {
    throw new StoreConfigError(`${key} is required`);
  }
  return normalized;
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseLocales(value: string): readonly StoreLocale[] {
  const locales = [...new Set(value.split(",").map((locale) => locale.trim()).filter(Boolean))];
  if (locales.length === 0) {
    throw new StoreConfigError("MENDESK_STORE_LOCALES must contain at least one locale");
  }
  return locales.map((locale) => parseLocale(locale, "MENDESK_STORE_LOCALES"));
}

function parseLocale(value: string, key: string): StoreLocale {
  if (!supportedStoreLocales.includes(value as StoreLocale)) {
    throw new StoreConfigError(`${key} contains an unsupported locale: ${value}`);
  }
  return value as StoreLocale;
}

function assertTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value }).format();
  } catch {
    throw new StoreConfigError(`MENDESK_STORE_TIME_ZONE is invalid: ${value}`);
  }
}

function parseWebUrl(value: string, key: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new StoreConfigError(`${key} must be an absolute HTTP or HTTPS URL`);
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password) {
    throw new StoreConfigError(`${key} must be an HTTP or HTTPS URL without credentials`);
  }
  return url.toString().replace(/\/$/, "");
}

export type ShopProfile = Readonly<{
  name: string;
  contactEmail: string;
  contactPhone: string;
  whatsappNumber?: string;
  address?: string;
  setupCompletedAt?: string;
}>;

export class ShopProfileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopProfileValidationError";
  }
}

export function normalizeShopProfile(input: Omit<ShopProfile, "setupCompletedAt">): Omit<ShopProfile, "setupCompletedAt"> {
  const name = required(input.name, "name", 100);
  const contactEmail = required(input.contactEmail, "email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    throw new ShopProfileValidationError("Enter a valid email address");
  }
  const contactPhone = phone(required(input.contactPhone, "phone", 40), "phone");
  const whatsappNumber = optional(input.whatsappNumber, 40);
  const address = optional(input.address, 500);

  return {
    name,
    contactEmail,
    contactPhone,
    ...(whatsappNumber ? { whatsappNumber: phone(whatsappNumber, "WhatsApp number") } : {}),
    ...(address ? { address } : {}),
  };
}

function required(value: string, label: string, max: number): string {
  const normalized = value.trim();
  if (!normalized) throw new ShopProfileValidationError(`Enter the workshop ${label}`);
  if (normalized.length > max) throw new ShopProfileValidationError(`${label} is too long`);
  return normalized;
}

function optional(value: string | undefined, max: number): string | undefined {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  if (normalized.length > max) throw new ShopProfileValidationError("One of the optional fields is too long");
  return normalized;
}

function phone(value: string, label: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new ShopProfileValidationError(`Enter a valid ${label}`);
  }
  return value;
}

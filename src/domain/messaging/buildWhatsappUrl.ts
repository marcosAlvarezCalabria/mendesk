import type { PhoneNumber } from "@/domain/values/PhoneNumber";

export function buildWhatsappUrl(phone: PhoneNumber, message: string): string {
  return `https://wa.me/${phone.value}?text=${encodeURIComponent(message)}`;
}
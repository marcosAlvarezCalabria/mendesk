import type { Order } from "@/domain/entities/Order";
import { buildWhatsappUrl } from "@/domain/messaging/buildWhatsappUrl";
import { buildReviewRequestMessage } from "@/domain/messaging/whatsappMessages";
import type { Locale } from "@/i18n/locale";

export function buildReviewWhatsappUrl(
  order: Order,
  reviewUrl: string | undefined,
  locale: Locale,
): string | undefined {
  if (order.status.value !== "collected" || !reviewUrl || !order.client.phone) {
    return undefined;
  }

  const message = buildReviewRequestMessage({ clientName: order.client.name, reviewUrl, locale });
  return buildWhatsappUrl(order.client.phone, message);
}

import type { Order } from "@/domain/entities/Order";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";

export function shouldOfferClientAnonymization(
  clientName: string,
  orders: readonly Pick<Order, "garments">[],
): boolean {
  if (clientName !== ANONYMIZED_CLIENT_NAME) {
    return true;
  }
  return orders.some((order) => order.garments.some((garment) => Boolean(garment.photoId)));
}

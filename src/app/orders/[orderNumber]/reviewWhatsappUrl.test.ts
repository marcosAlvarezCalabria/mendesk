import { describe, expect, it } from "vitest";

import { buildReviewWhatsappUrl } from "@/app/orders/[orderNumber]/reviewWhatsappUrl";
import type { Order } from "@/domain/entities/Order";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { PhoneNumber } from "@/domain/values/PhoneNumber";

describe("buildReviewWhatsappUrl", () => {
  it("uses the active Ukrainian locale for a collected order", () => {
    const url = buildReviewWhatsappUrl(makeOrder(OrderStatus.COLLECTED), "https://example.com/review", "uk");

    expect(readWhatsappMessage(url)).toContain("відгук");
  });

  it("returns no URL without a review URL or before collection", () => {
    expect(buildReviewWhatsappUrl(makeOrder(OrderStatus.COLLECTED), undefined, "en")).toBeUndefined();
    expect(buildReviewWhatsappUrl(makeOrder(OrderStatus.READY), "https://example.com/review", "en")).toBeUndefined();
  });

  it("returns no URL for an anonymized client without a phone", () => {
    const order = makeOrder(OrderStatus.COLLECTED, null);

    expect(buildReviewWhatsappUrl(order, "https://example.com/review", "en")).toBeUndefined();
  });
});

function makeOrder(status: Order["status"], phone = PhoneNumber.fromRaw("353851234567") as Order["client"]["phone"]): Order {
  return {
    status,
    client: {
      name: "Олена",
      phone,
    },
  } as Order;
}

function readWhatsappMessage(url: string | undefined): string {
  if (!url) {
    throw new Error("Expected a WhatsApp URL");
  }

  const message = new URL(url).searchParams.get("text");

  if (!message) {
    throw new Error("Expected a WhatsApp message");
  }

  return message;
}

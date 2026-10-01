import { describe, expect, it } from "vitest";

import { shouldOfferClientAnonymization } from "@/app/clients/[id]/anonymizationView";
import type { Garment } from "@/domain/entities/Garment";
import { ANONYMIZED_CLIENT_NAME } from "@/domain/gdpr/anonymization";
import { Money } from "@/domain/values/Money";

describe("shouldOfferClientAnonymization", () => {
  it("keeps the action available while an anonymized client still has a photo to remove", () => {
    expect(shouldOfferClientAnonymization(ANONYMIZED_CLIENT_NAME, [{ garments: [garment("photo-1")] }])).toBe(true);
  });

  it("hides the action after personal details and photos are gone", () => {
    expect(shouldOfferClientAnonymization(ANONYMIZED_CLIENT_NAME, [{ garments: [garment()] }])).toBe(false);
  });

  it("offers the action to an active client without photos", () => {
    expect(shouldOfferClientAnonymization("Ada Lovelace", [])).toBe(true);
  });
});

function garment(photoId?: string): Garment {
  return {
    id: "garment-1",
    orderId: "order-1",
    description: "Dress",
    alterationType: "hem",
    measurements: undefined,
    photoId,
    price: Money.fromEuros(20),
    dateUpdated: new Date("2026-09-06T08:00:00.000Z"),
  };
}

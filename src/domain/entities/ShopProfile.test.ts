import { describe, expect, it } from "vitest";
import { normalizeShopProfile, ShopProfileValidationError } from "./ShopProfile";

describe("ShopProfile", () => {
  it("normalizes the first-run workshop details", () => {
    expect(normalizeShopProfile({
      name: "  Needle & Thread  ", contactEmail: " OWNER@EXAMPLE.COM ", contactPhone: "+353 85 123 4567",
      whatsappNumber: " ", address: "  1 Main Street  ",
    })).toEqual({
      name: "Needle & Thread", contactEmail: "owner@example.com", contactPhone: "+353 85 123 4567",
      address: "1 Main Street",
    });
  });

  it("rejects invalid contact details", () => {
    expect(() => normalizeShopProfile({ name: "Shop", contactEmail: "bad", contactPhone: "123" }))
      .toThrow(ShopProfileValidationError);
  });
});

import { describe, expect, it } from "vitest";

import {
  isEditGarmentDraftDirty,
  makeEditGarmentDraft,
  updateEditGarmentDraft,
} from "@/app/orders/[orderNumber]/editGarmentDraft";

describe("edit garment draft", () => {
  it("preserves alteration type and measurements while other fields change", () => {
    const initial = makeEditGarmentDraft({ description: "Dress", alterationType: "waist", measurements: "Take in 2cm", price: "30.00" });
    const withDescription = updateEditGarmentDraft(initial, "description", "Blue dress");
    const withPrice = updateEditGarmentDraft(withDescription, "price", "35.00");

    expect(withPrice).toEqual({ description: "Blue dress", alterationType: "waist", measurements: "Take in 2cm", price: "35.00" });
  });

  it("updates measurements and alteration type without changing description or price", () => {
    const initial = makeEditGarmentDraft({ description: "Dress", alterationType: "hem", measurements: "4 cm", price: "20.00" });
    const withMeasurements = updateEditGarmentDraft(initial, "measurements", "6 cm");
    const withAlteration = updateEditGarmentDraft(withMeasurements, "alterationType", "sleeves");

    expect(withAlteration).toEqual({ description: "Dress", alterationType: "sleeves", measurements: "6 cm", price: "20.00" });
  });

  it("detects only garment values that differ from the last saved draft", () => {
    const saved = makeEditGarmentDraft({ description: "Dress", alterationType: "hem", measurements: "4 cm", price: "20.00" });

    expect(isEditGarmentDraftDirty(saved, saved)).toBe(false);
    expect(isEditGarmentDraftDirty(updateEditGarmentDraft(saved, "description", "Blue dress"), saved)).toBe(true);
    expect(isEditGarmentDraftDirty(updateEditGarmentDraft(saved, "alterationType", "waist"), saved)).toBe(true);
    expect(isEditGarmentDraftDirty(updateEditGarmentDraft(saved, "measurements", "6 cm"), saved)).toBe(true);
    expect(isEditGarmentDraftDirty(updateEditGarmentDraft(saved, "price", "25.00"), saved)).toBe(true);
  });

  it("treats trimmed text values as the saved values", () => {
    const saved = makeEditGarmentDraft({ description: "Dress", alterationType: "hem", measurements: "4 cm", price: "20.00" });
    const draft = { ...saved, description: "  Dress  ", measurements: "  4 cm  " };

    expect(isEditGarmentDraftDirty(draft, saved)).toBe(false);
  });
});

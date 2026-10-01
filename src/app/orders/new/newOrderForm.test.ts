import { describe, expect, it } from "vitest";

import { collectGarmentInputs, parseDueDate } from "@/app/orders/new/newOrderForm";

describe("collectGarmentInputs", () => {
  it("normalizes valid garment rows and discards fully empty rows", () => {
    const garments = collectGarmentInputs(
      [" Blue dress ", "Wool coat", ""],
      ["hem", "sleeves", "other"],
      [" shorten 3cm ", "   ", ""],
      ["45.50", "19.5", ""],
    );

    expect(garments).toEqual([
      { description: "Blue dress", alterationType: "hem", measurements: "shorten 3cm", priceEuros: 45.5, sourceIndex: 0 },
      { description: "Wool coat", alterationType: "sleeves", measurements: undefined, priceEuros: 19.5, sourceIndex: 1 },
    ]);
  });

  it("keeps rows with a description and no price while discarding fully empty rows", () => {
    const garments = collectGarmentInputs(["Blue dress", ""], ["hem", "other"], ["", ""], ["", ""]);

    expect(garments).toHaveLength(1);
    expect(garments[0]?.description).toBe("Blue dress");
    expect(garments[0]?.alterationType).toBe("hem");
    expect(garments[0]?.measurements).toBeUndefined();
    expect(garments[0]?.priceEuros).toBeNaN();
    expect(garments[0]?.sourceIndex).toBe(0);
  });

  it("preserves source indexes when an empty row is discarded between garments", () => {
    const garments = collectGarmentInputs(["Blue dress", "", "Wool coat"], ["hem", "other", "sleeves"], ["", "", "cuffs"], ["45", "", "20"]);

    expect(garments.map((garment) => garment.sourceIndex)).toEqual([0, 2]);
  });
});

describe("parseDueDate", () => {
  it("parses an input date value into that calendar day", () => {
    const date = parseDueDate("2026-08-25");

    expect(date).toBeInstanceOf(Date);
    expect(date?.getUTCFullYear()).toBe(2026);
    expect(date?.getUTCMonth()).toBe(7);
    expect(date?.getUTCDate()).toBe(25);
  });

  it("returns null for empty, missing, or invalid dates", () => {
    expect(parseDueDate("")).toBeNull();
    expect(parseDueDate(undefined)).toBeNull();
    expect(parseDueDate("nope")).toBeNull();
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AddGarmentForm, type AddGarmentTexts } from "@/app/orders/[orderNumber]/AddGarmentForm";

const texts: AddGarmentTexts = {
  ariaLabel: "Add garment",
  title: "Add garment",
  description: "Description",
  descriptionPlaceholder: "Blue dress",
  alterationType: "Alteration type",
  alterationLabels: {
    hem: "Hem",
    waist: "Waist",
    zipper: "Zipper",
    sleeves: "Sleeves",
    take_in: "Take in",
    other: "Other",
  },
  price: "Price",
  measurements: "Measurements",
  measurementsPlaceholder: "Optional measurements",
  photo: "Photo",
  submit: "Add garment",
  submitting: "Adding garment",
  success: "Garment added.",
  checkSaved: "Check Directus",
  checkingSaved: "Checking Directus...",
  confirmedAbsent: "Not saved.",
  confirmedSaved: "Saved.",
  errors: {
    description: "Enter a description.",
    notEditable: "This order cannot be edited.",
    price: "Enter a valid price.",
    saveFailed: "Could not add garment.",
  },
};

describe("AddGarmentForm", () => {
  it("renders the add-garment fields collapsed initially", () => {
    const html = renderToStaticMarkup(<AddGarmentForm idempotencyKey="550e8400-e29b-41d4-a716-446655440001" orderNumber="260902-0007" texts={texts} />);

    expect(html).toContain("<details");
    expect(html).toContain('name="order-detail-editor"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain("<summary");
    expect(html).toContain('name="idempotency_key"');
    expect(html).toContain('value="550e8400-e29b-41d4-a716-446655440001"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditGarmentForm, type EditGarmentTexts } from "@/app/orders/[orderNumber]/EditGarmentForm";

const texts: EditGarmentTexts = {
  edit: "Edit garment",
  description: "Description",
  descriptionPlaceholder: "Blue dress",
  alterationType: "Alteration type",
  alterationLabels: { hem: "Hem", waist: "Waist", zipper: "Zipper", sleeves: "Sleeves", take_in: "Take in", other: "Other" },
  price: "Price",
  measurements: "Measurements",
  measurementsPlaceholder: "Optional measurements",
  save: "Save",
  saving: "Saving...",
  checkSaved: "Check saved",
  unsaved: "Unsaved changes",
  errors: { notEditable: "Not editable", description: "Add a description", price: "Enter a valid price", saveFailed: "Save failed" },
  checkingSaved: "Checking...",
};

describe("EditGarmentForm", () => {
  it("starts collapsed in the shared order-detail editor group", () => {
    const html = renderToStaticMarkup(<EditGarmentForm orderNumber="260910-0020" garment={{ id: "garment-1", dateUpdated: "2026-09-10T10:00:00.000Z", description: "Dress", alterationType: "hem", measurements: "4 cm", price: "20.00" }} texts={texts} />);

    expect(html).toContain('name="order-detail-editor"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain('name="description"');
    expect(html).toContain('required=""');
    expect(html).toContain("Edit garment");
  });
});

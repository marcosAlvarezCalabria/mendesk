import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RemoveGarmentForm, type RemoveGarmentTexts } from "@/app/orders/[orderNumber]/RemoveGarmentForm";

const texts: RemoveGarmentTexts = {
  remove: "Remove garment",
  cancel: "Cancel",
  confirmation: "Remove {description}?",
  confirm: "Yes, remove garment",
  removing: "Removing...",
  checkSaved: "Check saved",
  checkingSaved: "Checking...",
  success: "Garment removed.",
  lastGarmentHint: "Add another garment before removing this one.",
  errors: { lastGarment: "Last garment", notEditable: "Not editable", notFound: "Not found", deleteFailed: "Failed", conflict: "Conflict" },
};

describe("RemoveGarmentForm", () => {
  it("keeps Remove garment visible when the order has only one garment", () => {
    const html = renderToStaticMarkup(<RemoveGarmentForm orderNumber="260910-0020" garmentId="garment-1" expectedDateUpdated="2026-09-10T10:00:00.000Z" description="Dress" canRemove={false} texts={texts} />);

    expect(html).toContain("Remove garment");
    expect(html).toContain("Add another garment before removing this one.");
    expect(html).toContain("<button");
  });
});

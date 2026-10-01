import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EditOrderDetailsForm, type EditOrderDetailsTexts } from "@/app/orders/[orderNumber]/EditOrderDetailsForm";

const texts: EditOrderDetailsTexts = {
  title: "Edit order",
  dueDate: "Due date",
  notes: "Notes",
  notesPlaceholder: "Optional notes",
  save: "Save changes",
  saved: "Changes saved",
  saving: "Saving...",
  checkSaved: "Check saved",
  checkingSaved: "Checking...",
  unsaved: "Unsaved changes",
  error: "The order could not be saved.",
};

describe("EditOrderDetailsForm", () => {
  it("starts collapsed in the shared order-detail editor group", () => {
    const html = renderToStaticMarkup(<EditOrderDetailsForm orderNumber="260910-0020" dateUpdated="2026-09-10T10:00:00.000Z" dueDateValue="2026-09-12" notes="Call first" texts={texts} />);

    expect(html).toContain('name="order-detail-editor"');
    expect(html).not.toMatch(/<details[^>]*\sopen(?:=|\s|>)/);
    expect(html).toContain("Edit order");
  });
});

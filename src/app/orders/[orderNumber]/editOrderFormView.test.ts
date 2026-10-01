import { describe, expect, it } from "vitest";

import { editOrderFormView } from "@/app/orders/[orderNumber]/editOrderFormView";

describe("editOrderFormView", () => {
  it("shows a quiet saved state before anything changes", () => {
    expect(editOrderFormView({ dirty: false, pending: false })).toEqual({
      buttonLabel: "saved",
      disabled: true,
      showUnsavedWarning: false,
      tone: "saved",
    });
  });

  it("turns the button into a clear save action after a change", () => {
    expect(editOrderFormView({ dirty: true, pending: false })).toEqual({
      buttonLabel: "save",
      disabled: false,
      showUnsavedWarning: true,
      tone: "unsaved",
    });
  });

  it("keeps the pending state disabled while saving", () => {
    expect(editOrderFormView({ dirty: true, pending: true })).toEqual({
      buttonLabel: "saving",
      disabled: true,
      showUnsavedWarning: false,
      tone: "saving",
    });
  });
});

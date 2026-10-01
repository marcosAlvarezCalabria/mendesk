import { describe, expect, it } from "vitest";
import { mobileDialogPanelClassName, mobileNativeDialogClassName, mobileOverlayClassName } from "./mobileOverlay";

describe("mobile overlays", () => {
  it("keep every popup above the persistent navigation and inside the viewport", () => {
    expect(mobileOverlayClassName).toContain("pb-[calc(5rem+env(safe-area-inset-bottom))]");
    expect(mobileDialogPanelClassName).toContain("max-h-[calc(100dvh-6rem-env(safe-area-inset-bottom))]");
    expect(mobileDialogPanelClassName).toContain("max-w-full");
    expect(mobileNativeDialogClassName).toContain("mb-[calc(5rem+env(safe-area-inset-bottom))]");
  });
});

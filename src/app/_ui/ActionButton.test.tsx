import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActionButton } from "@/app/_ui/ActionButton";

describe("ActionButton", () => {
  it("supports a compact size without reducing the touch target below 44 pixels", () => {
    const html = renderToStaticMarkup(
      <ActionButton icon="check" size="compact" variant="primary">Save</ActionButton>,
    );

    expect(html).toContain("min-h-12");
    expect(html).toContain("text-label-md");
    expect(html).not.toContain("min-h-14");
  });
});

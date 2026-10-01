import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { NewOrderHeader } from "./NewOrderHeader";

describe("NewOrderHeader", () => {
  it("keeps the order title and progress in one compact header without repeating the brand", () => {
    const html = renderToStaticMarkup(
      <NewOrderHeader
        backLabel="Back"
        current="review"
        onBack={vi.fn()}
        stepLabel="Step {current} of {total}"
        title="New order"
      />,
    );

    expect(html).toContain("New order");
    expect(html).toContain("Step 4 of 4");
    expect(html).not.toContain("Koko Atelier");
    expect(html.match(/data-progress-segment=/g)).toHaveLength(4);
    expect(html).toContain("max-w-[42%]");
    expect(html).toContain("whitespace-normal");
  });
});

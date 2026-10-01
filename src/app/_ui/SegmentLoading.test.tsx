import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SegmentLoading } from "@/app/_ui/SegmentLoading";

describe("SegmentLoading", () => {
  it.each(["list", "detail", "form"] as const)("reserves a stable, accessible %s layout", (variant) => {
    const markup = renderToStaticMarkup(<SegmentLoading variant={variant} />);

    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain("min-h-screen");
    expect(markup).toContain("motion-reduce:animate-none");
    expect(markup).toContain(`data-variant="${variant}"`);
  });
});

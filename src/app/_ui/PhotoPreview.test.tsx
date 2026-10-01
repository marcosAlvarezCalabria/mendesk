import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PhotoPreview } from "@/app/_ui/PhotoPreview";

describe("PhotoPreview", () => {
  it("renders loading skeletons before enabling the thumbnail and full-size preview", () => {
    const html = renderToStaticMarkup(
      <PhotoPreview
        alt="Photo of blue dress"
        closeLabel="Close photo"
        openLabel="View photo"
        src="/api/photos/file-1"
        thumbnailClassName="size-24"
      />,
    );

    expect(html).toContain('data-photo-preview="thumbnail"');
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('data-photo-skeleton="thumbnail"');
    expect(html).toContain('data-photo-skeleton="full"');
    expect(html).toContain('disabled=""');
    expect(html).toContain('aria-label="View photo"');
    expect(html).toContain("<dialog");
    expect(html).toContain('aria-label="Photo of blue dress"');
    expect(html).toContain("Close photo");
  });
});

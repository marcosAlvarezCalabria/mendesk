import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GarmentPhotoPicker } from "@/app/orders/new/NewOrderClientForm";

describe("GarmentPhotoPicker", () => {
  it("offers separate camera and photo-library inputs on mobile", () => {
    const html = renderToStaticMarkup(
      <GarmentPhotoPicker
        choosePhotoLabel="Choose photo"
        closePhotoLabel="Close photo"
        emptyLabel="No photo"
        garmentId={7}
        onPhotoChange={vi.fn()}
        photo={null}
        photoAltLabel="Photo"
        takePhotoLabel="Take photo"
        viewPhotoLabel="View photo"
      />,
    );

    expect(html).toContain("Take photo");
    expect(html).toContain("Choose photo");
    expect(html).toContain('capture="environment"');
    expect(html.match(/accept="image\/\*"/g)).toHaveLength(2);
    expect(html.match(/capture="environment"/g)).toHaveLength(1);
  });

  it("shows an empty photo state without exposing a file name", () => {
    const html = renderToStaticMarkup(
      <GarmentPhotoPicker
        choosePhotoLabel="Choose photo"
        closePhotoLabel="Close photo"
        emptyLabel="No photo"
        garmentId={7}
        onPhotoChange={vi.fn()}
        photo={null}
        photoAltLabel="Photo"
        takePhotoLabel="Take photo"
        viewPhotoLabel="View photo"
      />,
    );

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("No photo");
    expect(html).not.toContain(".jpg");
  });
});

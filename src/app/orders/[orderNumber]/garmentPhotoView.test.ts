import { describe, expect, it } from "vitest";

import { garmentPhotoView } from "@/app/orders/[orderNumber]/garmentPhotoView";

describe("garmentPhotoView", () => {
  it("shows the signed photo before a local load failure", () => {
    expect(garmentPhotoView("/api/photos/file-1", 0, false)).toEqual({ src: "/api/photos/file-1", showImage: true, showRetry: false });
  });

  it("keeps a failed photo local and offers retry", () => {
    expect(garmentPhotoView("/api/photos/file-1", 0, true)).toEqual({ src: "/api/photos/file-1", showImage: false, showRetry: true });
  });

  it("cache-busts only the photo request on retry", () => {
    expect(garmentPhotoView("/api/photos/file-1", 2, false).src).toBe("/api/photos/file-1?retry=2");
  });
});

import { describe, expect, it } from "vitest";

import { preserveGarmentPhotos } from "./newOrderSubmission";

describe("preserveGarmentPhotos", () => {
  it("resends the same garment UUID and photo bytes after the native file input was reset", async () => {
    const idempotencyKey = "550e8400-e29b-41d4-a716-446655440001";
    const cachedPhoto = new File([new Uint8Array([4, 8, 15, 16, 23, 42])], "dress.jpg", { type: "image/jpeg" });
    const formData = new FormData();
    formData.set("garment_idempotency_key", idempotencyKey);
    formData.set("garment_photo", new File([], ""));

    preserveGarmentPhotos(formData, [cachedPhoto]);

    const resentPhoto = formData.get("garment_photo") as File;
    expect(formData.get("garment_idempotency_key")).toBe(idempotencyKey);
    expect(resentPhoto.name).toBe("dress.jpg");
    expect(resentPhoto.type).toBe("image/jpeg");
    expect(new Uint8Array(await resentPhoto.arrayBuffer())).toEqual(new Uint8Array([4, 8, 15, 16, 23, 42]));
  });
});

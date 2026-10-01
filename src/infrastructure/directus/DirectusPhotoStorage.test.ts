import { describe, expect, it } from "vitest";

import type { PhotoUpload } from "@/application/ports/PhotoStorage";
import type { DirectusFileUpload, DirectusFilesGateway } from "@/infrastructure/directus/DirectusFilesGateway";
import { DirectusPhotoStorage } from "@/infrastructure/directus/DirectusPhotoStorage";

describe("DirectusPhotoStorage", () => {
  it("uploads photo bytes through the Directus files gateway and returns the file id", async () => {
    const gateway = new FakeDirectusFilesGateway("file-123");
    const storage = new DirectusPhotoStorage(gateway);
    const photo: PhotoUpload = {
      bytes: new Uint8Array([1, 2, 3]),
      filename: "dress.jpg",
      contentType: "image/jpeg",
    };

    const id = await storage.upload(photo);

    expect(gateway.lastUpload).toEqual(photo);
    expect(id).toBe("file-123");
  });

  it("returns the internal panel photo route for a stored file id", async () => {
    const storage = new DirectusPhotoStorage(new FakeDirectusFilesGateway("file-123"));

    await expect(storage.getSignedUrl("file-123")).resolves.toBe("/api/photos/file-123");
  });

  it.each([
    { stored: [1, 2, 3], requested: [1, 2, 3], expected: true },
    { stored: [1, 2, 3], requested: [1, 2, 4], expected: false },
    { stored: [1, 2, 3], requested: [1, 2], expected: false },
  ])("compares the persisted asset bytes with the requested photo", async ({ stored, requested, expected }) => {
    const storage = new DirectusPhotoStorage(new FakeDirectusFilesGateway("file-123", new Uint8Array(stored)));

    await expect(storage.matches("file-123", {
      bytes: new Uint8Array(requested),
      filename: "dress.jpg",
      contentType: "image/jpeg",
    })).resolves.toBe(expected);
  });

  it("escapes the file id when building the internal panel photo route", async () => {
    const storage = new DirectusPhotoStorage(new FakeDirectusFilesGateway("file-123"));

    await expect(storage.getSignedUrl("a b")).resolves.toBe("/api/photos/a%20b");
  });
});

class FakeDirectusFilesGateway implements DirectusFilesGateway {
  lastUpload: DirectusFileUpload | null = null;

  constructor(private readonly fileId: string, private readonly storedBytes = new Uint8Array()) {}

  async uploadFile(payload: DirectusFileUpload): Promise<string> {
    this.lastUpload = payload;
    return this.fileId;
  }

  async deleteFile(id: string): Promise<void> {
    void id;
  }

  async readFileBytes(id: string): Promise<Uint8Array> {
    expect(id).toBe(this.fileId);
    return this.storedBytes;
  }

}

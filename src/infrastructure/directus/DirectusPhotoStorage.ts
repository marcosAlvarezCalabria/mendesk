import type { PhotoStorage, PhotoUpload } from "@/application/ports/PhotoStorage";
import type { DirectusFilesGateway } from "@/infrastructure/directus/DirectusFilesGateway";

export class DirectusPhotoStorage implements PhotoStorage {
  constructor(private readonly gateway: DirectusFilesGateway) {}

  upload(photo: PhotoUpload): Promise<string> {
    return this.gateway.uploadFile(photo);
  }

  delete(photoId: string): Promise<void> {
    return this.gateway.deleteFile(photoId);
  }

  async getSignedUrl(photoId: string): Promise<string> {
    return `/api/photos/${encodeURIComponent(photoId)}`;
  }

  async matches(photoId: string, photo: PhotoUpload): Promise<boolean> {
    const stored = await this.gateway.readFileBytes(photoId);
    if (stored.byteLength !== photo.bytes.byteLength) return false;

    return stored.every((value, index) => value === photo.bytes[index]);
  }
}

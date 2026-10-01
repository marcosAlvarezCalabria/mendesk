export type PhotoUpload = {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
};

export interface PhotoStorage {
  upload(photo: PhotoUpload): Promise<string>;
  delete(photoId: string): Promise<void>;
  getSignedUrl(photoId: string): Promise<string>;
  matches(photoId: string, photo: PhotoUpload): Promise<boolean>;
}

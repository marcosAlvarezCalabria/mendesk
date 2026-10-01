export type GarmentPhotoView = {
  src: string;
  showImage: boolean;
  showRetry: boolean;
};

export function garmentPhotoView(photoUrl: string, attempt: number, failed: boolean): GarmentPhotoView {
  const separator = photoUrl.includes("?") ? "&" : "?";
  return {
    src: attempt > 0 ? `${photoUrl}${separator}retry=${attempt}` : photoUrl,
    showImage: !failed,
    showRetry: failed,
  };
}

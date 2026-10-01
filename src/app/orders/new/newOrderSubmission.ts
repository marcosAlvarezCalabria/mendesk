export function preserveGarmentPhotos(
  formData: FormData,
  photos: readonly (File | null | undefined)[],
): void {
  formData.delete("garment_photo");

  for (const photo of photos) {
    formData.append("garment_photo", photo ?? new File([], ""));
  }
}

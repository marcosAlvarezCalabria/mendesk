"use client";


import { useState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { PhotoPreview } from "@/app/_ui/PhotoPreview";
import { garmentPhotoView } from "@/app/orders/[orderNumber]/garmentPhotoView";

export function GarmentPhoto({ photoUrl, alt, closeLabel, openLabel, retryLabel }: { photoUrl: string | null; alt: string; closeLabel: string; openLabel: string; retryLabel: string }) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!photoUrl) {
    return (
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-container-low text-outline" aria-hidden="true">
        <Icon className="size-4" name="image" />
      </div>
    );
  }

  const view = garmentPhotoView(photoUrl, attempt, failed);

  if (view.showRetry) {
    return (
      <button
        aria-label={retryLabel}
        className="flex size-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg bg-error-container text-[0.6875rem] font-bold leading-none text-on-error-container focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2"
        onClick={() => { setAttempt((value) => value + 1); setFailed(false); }}
        type="button"
      >
        <Icon className="size-4" name="sync" />
        <span>{retryLabel}</span>
      </button>
    );
  }

  return (
    <PhotoPreview
      alt={alt}
      closeLabel={closeLabel}
      key={view.src}
      onError={() => setFailed(true)}
      openLabel={openLabel}
      sizes="56px"
      src={view.src}
      thumbnailClassName="size-14"
    />
  );
}

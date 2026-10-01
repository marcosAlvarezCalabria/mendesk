"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Icon } from "@/app/_ui/Icon";

type PhotoPreviewProps = {
  alt: string;
  closeLabel: string;
  onError?: () => void;
  openLabel: string;
  showCaption?: boolean;
  sizes?: string;
  src: string;
  thumbnailClassName: string;
};

export function PhotoPreview({
  alt,
  closeLabel,
  onError,
  openLabel,
  showCaption = false,
  sizes = "96px",
  src,
  thumbnailClassName,
}: PhotoPreviewProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [loadedThumbnailSrc, setLoadedThumbnailSrc] = useState<string | null>(null);
  const [loadedFullSrc, setLoadedFullSrc] = useState<string | null>(null);
  const thumbnailLoaded = loadedThumbnailSrc === src;
  const fullLoaded = loadedFullSrc === src;
  return (
    <>
      <button
        aria-label={openLabel}
        aria-busy={!thumbnailLoaded}
        className={`relative shrink-0 overflow-hidden rounded-lg bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 ${thumbnailLoaded ? "cursor-zoom-in" : "cursor-wait"} ${thumbnailClassName}`}
        data-photo-preview="thumbnail"
        disabled={!thumbnailLoaded}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        <Image alt={alt} className={`object-cover transition-opacity duration-200 ${thumbnailLoaded ? "opacity-100" : "opacity-0"}`} fill onError={onError} onLoad={() => setLoadedThumbnailSrc(src)} sizes={sizes} src={src} unoptimized />
        {!thumbnailLoaded ? <PhotoSkeleton kind="thumbnail" /> : null}
        {thumbnailLoaded && showCaption ? <span className="absolute inset-x-0 bottom-0 bg-primary/85 px-2 py-1 text-center text-label-sm text-on-primary">{openLabel}</span> : null}
        {thumbnailLoaded && !showCaption ? <span aria-hidden="true" className="absolute bottom-1 right-1 flex size-6 items-center justify-center rounded-full bg-primary/85 text-on-primary"><Icon className="size-3.5" name="search" /></span> : null}
      </button>

      <dialog
        aria-label={alt}
        aria-modal="true"
        aria-busy={!fullLoaded}
        className="m-auto h-[100dvh] max-h-none w-screen max-w-none border-0 bg-primary/95 p-0 text-on-primary backdrop:bg-black/70 sm:h-[min(90dvh,48rem)] sm:w-[min(92vw,64rem)] sm:rounded-xl"
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
        ref={dialogRef}
      >
        <div className="relative flex h-full min-h-0 flex-col p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
          <button
            className="ml-auto inline-flex min-h-11 items-center rounded-full bg-white/15 px-4 text-label-md font-bold text-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary"
            onClick={() => dialogRef.current?.close()}
            type="button"
          >
            {closeLabel}
          </button>
          <div className="relative mt-2 min-h-0 flex-1">
            <Image alt={alt} className={`object-contain transition-opacity duration-200 ${fullLoaded ? "opacity-100" : "opacity-0"}`} fill onError={onError} onLoad={() => setLoadedFullSrc(src)} sizes="100vw" src={src} unoptimized />
            {!fullLoaded ? <PhotoSkeleton kind="full" /> : null}
          </div>
        </div>
      </dialog>
    </>
  );
}

function PhotoSkeleton({ kind }: { kind: "thumbnail" | "full" }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute inset-0 flex items-center justify-center motion-safe:animate-pulse ${kind === "full" ? "bg-white/10 text-white/60" : "bg-surface-container-high text-outline"}`}
      data-photo-skeleton={kind}
    >
      <Icon className={kind === "full" ? "size-8" : "size-5"} name="image" />
    </span>
  );
}

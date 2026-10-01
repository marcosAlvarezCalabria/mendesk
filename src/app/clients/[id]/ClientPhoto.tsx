"use client";

import { useState } from "react";
import { PhotoPreview } from "@/app/_ui/PhotoPreview";
import { dictionaries } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/locale";
export function ClientPhoto({ photoId, description, locale }: { photoId: string; description: string; locale: Locale }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (failed) return <button type="button" className="min-h-11 max-w-32 rounded-lg border border-outline-variant p-2 text-body-sm focus-visible:outline-2" onClick={() => { setFailed(false); setAttempt(value => value + 1); }}>{dictionaries[locale]["clients.photo.retry"]}</button>;
  return <PhotoPreview alt={description} closeLabel={dictionaries[locale]["orders.garments.closePhoto"]} onError={() => setFailed(true)} openLabel={dictionaries[locale]["orders.garments.viewPhoto"]} sizes="64px" src={`/api/photos/${encodeURIComponent(photoId)}?attempt=${attempt}`} thumbnailClassName="size-16" />;
}

"use client";

import Link from "next/link";

import type { NewOrderStep } from "./newOrderFlow";

const steps: readonly NewOrderStep[] = ["client", "garments", "delivery", "review"];

export function NewOrderHeader({
  backLabel,
  cancelHref,
  cancelLabel,
  current,
  onBack,
  stepLabel,
  title,
}: {
  backLabel: string;
  cancelHref?: string;
  cancelLabel?: string;
  current: NewOrderStep;
  onBack: () => void;
  stepLabel: string;
  title: string;
}) {
  const currentIndex = steps.indexOf(current);
  const progressLabel = stepLabel
    .replace("{current}", String(currentIndex + 1))
    .replace("{total}", String(steps.length));

  return (
    <header className="sticky top-0 z-20 border-b border-outline-variant bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto w-full max-w-[640px] px-margin-mobile">
        <div className="flex min-h-12 items-center gap-2">
          {current === "client" && cancelHref ? (
            <Link className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-2 text-label-md font-semibold text-secondary underline decoration-1 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-secondary" href={cancelHref} aria-label={backLabel}>{cancelLabel}</Link>
          ) : (
            <button className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-xl text-primary transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background" type="button" onClick={onBack} aria-label={backLabel}>←</button>
          )}
          <p className="min-w-0 flex-1 truncate text-label-lg text-on-surface">{title}</p>
          <p className="min-w-0 max-w-[42%] whitespace-normal text-right text-label-sm leading-tight text-on-surface-variant">{progressLabel}</p>
        </div>
        <div className="grid grid-cols-4 gap-1 pb-1" aria-hidden="true">
          {steps.map((step, index) => (
            <span className={`h-1 rounded-full ${index <= currentIndex ? "bg-secondary" : "bg-outline-variant"}`} data-progress-segment="" key={step} />
          ))}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { errorFallbackTexts } from "@/app/errorFallbackView";

export default function ErrorFallback({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [texts] = useState(() => errorFallbackTexts(typeof document === "undefined" ? "en" : document.documentElement.lang));

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] items-center px-margin-mobile py-10">
      <section className="w-full rounded-xl bg-surface-container-lowest p-card-padding shadow-[0_8px_28px_rgba(33,29,24,0.08)]" aria-labelledby="error-heading">
        <div className="flex size-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
          <Icon name="cloud_off" />
        </div>
        <h1 className="mt-5 text-headline-lg text-on-surface" id="error-heading">
          {texts.title}
        </h1>
        <p className="mt-2 max-w-[65ch] text-body-md text-on-surface-variant">{texts.description}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-5 text-label-lg text-on-primary transition hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
            onClick={reset}
            type="button"
          >
            <Icon name="refresh" />
            {texts.tryAgain}
          </button>
          <Link
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-outline-variant bg-surface-container-lowest px-5 text-label-lg text-primary transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
            href="/orders"
          >
            <Icon name="list_alt" />
            {texts.backToOrders}
          </Link>
        </div>
      </section>
    </main>
  );
}

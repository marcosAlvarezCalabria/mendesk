"use client";

import { useEffect, useState } from "react";

import { Icon } from "@/app/_ui/Icon";
import { statsCopy } from "@/app/stats/statsCopy";
import { isValidLocale } from "@/i18n/locale";

export default function StatsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [copy] = useState(() => statsCopy(typeof document !== "undefined" && isValidLocale(document.documentElement.lang) ? document.documentElement.lang : "en"));
  useEffect(() => console.error(error), [error]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[720px] items-center px-margin-mobile pb-24">
      <section className="w-full rounded-xl bg-surface-container-lowest p-5 shadow-[0_8px_28px_rgba(33,29,24,0.08)]" aria-labelledby="stats-error-heading">
        <div className="flex size-11 items-center justify-center rounded-full bg-error-container text-on-error-container"><Icon name="bar_chart_off" /></div>
        <h1 className="mt-4 text-headline-md text-on-surface" id="stats-error-heading">{copy.unavailableTitle}</h1>
        <p className="mt-2 max-w-[65ch] text-body-md text-on-surface-variant">{copy.unavailableDescription}</p>
        <button className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-label-lg text-on-primary focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" onClick={reset} type="button">
          <Icon name="refresh" />{copy.tryAgain}
        </button>
      </section>
    </main>
  );
}

"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/app/_ui/Icon";
import type { Locale } from "@/i18n/locale";
import { setLocale } from "@/i18n/setLocale";

type LocaleToggleProps = {
  availableLocales?: readonly Locale[];
  currentLocale: Locale;
  label: string;
};

const locales: readonly { value: Locale; name: string }[] = [
  { value: "en", name: "English" },
  { value: "es", name: "Español" },
  { value: "uk", name: "Українська" },
];

export function LocaleToggle({ availableLocales = locales.map(({ value }) => value), currentLocale, label }: LocaleToggleProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const visibleLocales = locales.filter(({ value }) => availableLocales.includes(value));

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      const details = detailsRef.current;
      if (details && !details.contains(event.target as Node)) details.open = false;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && detailsRef.current?.open) {
        detailsRef.current.open = false;
        detailsRef.current.querySelector("summary")?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (visibleLocales.length < 2) return null;

  return (
    <details className="group relative" ref={detailsRef}>
      <summary
        aria-label={label}
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background group-open:bg-primary group-open:text-on-primary [&::-webkit-details-marker]:hidden"
      >
        <Icon className="size-[1.125rem]" name="language" />
      </summary>

      <div aria-label={label} className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-44 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-[0_12px_28px_rgba(31,27,23,0.16)] md:bottom-0 md:left-[calc(100%+0.5rem)] md:right-auto md:top-auto" role="group">
        {visibleLocales.map((locale) => (
          <form action={setLocale.bind(null, locale.value)} key={locale.value}>
            <button
              aria-pressed={locale.value === currentLocale}
              className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-label-md text-on-surface transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-inset aria-pressed:bg-primary aria-pressed:text-on-primary"
              lang={locale.value}
              onClick={() => { if (detailsRef.current) detailsRef.current.open = false; }}
              type="submit"
            >
              <span>{locale.name}</span>
              {locale.value === currentLocale ? <Icon className="size-4" name="check_circle" /> : null}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

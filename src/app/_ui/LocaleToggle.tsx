"use client";

import { cx } from "@/app/_ui/classNames";
import type { Locale } from "@/i18n/locale";
import { setLocale } from "@/i18n/setLocale";

type LocaleToggleProps = {
  currentLocale: Locale;
  label: string;
};

const locales: readonly { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "uk", label: "УКР" },
];

export function LocaleToggle({ currentLocale, label }: LocaleToggleProps) {
  return (
    <div aria-label={label} className="flex rounded-full border border-outline-variant bg-surface-container-lowest p-0.5 md:flex-col md:rounded-xl lg:flex-row lg:rounded-full" role="group">
      {locales.map((locale) => (
        <form action={setLocale.bind(null, locale.value)} key={locale.value}>
          <button
            aria-pressed={locale.value === currentLocale}
            className={cx(
              "min-h-11 min-w-11 rounded-full px-2.5 text-[0.6875rem] md:px-1 lg:px-2.5 font-bold transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background",
              locale.value === currentLocale ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low",
            )}
            type="submit"
          >
            {locale.label}
          </button>
        </form>
      ))}
    </div>
  );
}

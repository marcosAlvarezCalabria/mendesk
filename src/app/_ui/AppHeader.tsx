import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/dashboard/actions";
import { cx } from "@/app/_ui/classNames";
import { HeaderUtilitiesMenu } from "@/app/_ui/HeaderUtilitiesMenu";
import { Icon } from "@/app/_ui/Icon";
import { LocaleToggle } from "@/app/_ui/LocaleToggle";
import { dictionaries } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";
import { storeConfig } from "@/config/currentStore";

type AppHeaderProps = {
  variant?: "home" | "back";
  title?: string;
  subtitle?: string;
  className?: string;
  mobileAction?: ReactNode;
  backHref?: string;
  backLabel?: string;
};

export async function AppHeader({ variant = "home", title, subtitle, className, mobileAction, backHref = "/orders", backLabel }: AppHeaderProps) {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <header className={cx("sticky top-0 z-20 border-b border-outline-variant bg-surface-container-lowest pt-[env(safe-area-inset-top)]", className)}>
      <div className="mx-auto flex min-h-14 w-full max-w-[640px] items-center justify-between gap-3 px-4 py-2">
        <div className="flex min-w-0 items-center gap-2">
          {variant === "back" ? (
            <Link
              aria-label={backLabel ?? t(dict, "nav.backToOrders")}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary transition hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              href={backHref}
            >
              <Icon className="size-[1.125rem]" name="arrow_back" />
            </Link>
          ) : null}

          <div className="min-w-0">
            <p className="truncate font-wordmark text-[1.0625rem] font-medium leading-tight text-primary">{storeConfig.identity.name}</p>
            {title || subtitle ? (
              <div className="mt-0.5 min-w-0">
                {title ? <h1 className="truncate text-[0.6875rem] font-semibold leading-tight text-on-surface-variant">{title}</h1> : null}
                {subtitle ? <p className="truncate text-[0.6875rem] leading-tight text-on-surface-variant">{subtitle}</p> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span className="md:hidden"><LocaleToggle currentLocale={locale} label={t(dict, "nav.language")} /></span>
          {mobileAction ?? (
            <span className="md:hidden"><HeaderUtilitiesMenu
                labels={{ more: t(dict, "nav.more"), logout: t(dict, "nav.logOut") }}
                logoutAction={logoutAction}
              /></span>
          )}
        </div>
      </div>
    </header>
  );
}

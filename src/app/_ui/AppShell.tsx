"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import { LocaleToggle } from "@/app/_ui/LocaleToggle";
import { activeNavigationItem, buildNewOrderHref, isShellPath, shouldShowMobileNavigation, type NavigationItemKey } from "@/app/_ui/appShellNavigation";
import type { Locale } from "@/i18n/locale";
import { OrderSyncProvider } from "@/app/sync/OrderSyncProvider";
import { clearClientRegistrationRecovery } from "@/app/clients/new/clientRegistrationRecovery";
import type { StoreIdentity } from "@/config/storeConfig";

type AppShellLabels = {
  mainNavigation: string;
  language: string;
  orders: string;
  add: string;
  clients: string;
  appointments: string;
  stats: string;
  settings: string;
  logout: string;
};

type AppShellProps = {
  children: ReactNode;
  currentLocale: Locale;
  identity: StoreIdentity;
  labels: AppShellLabels;
  logoutAction: () => Promise<void>;
};

type NavigationLink = {
  key: NavigationItemKey;
  href: string;
  icon: string;
  label: string;
};

export function AppShell({ children, currentLocale, identity, labels, logoutAction }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const newOrderHref = buildNewOrderHref(pathname, searchParams.toString());

  if (!isShellPath(pathname)) {
    return children;
  }

  const showMobileNavigation = shouldShowMobileNavigation(pathname);

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden overflow-x-clip bg-background md:pl-20 lg:pl-60 print:pl-0">
    <OrderSyncProvider locale={currentLocale}>
      <DesktopNavigation currentLocale={currentLocale} identity={identity} labels={labels} logoutAction={logoutAction} newOrderHref={newOrderHref} pathname={pathname} />
      <div className={cx("min-w-0 max-w-full overflow-x-hidden overflow-x-clip", showMobileNavigation ? "pb-[calc(4.25rem+env(safe-area-inset-bottom))] md:pb-0 print:pb-0" : undefined)}>{children}</div>
      {showMobileNavigation ? <MobileNavigation labels={labels} newOrderHref={newOrderHref} pathname={pathname} /> : null}
    </OrderSyncProvider>
    </div>
  );
}

function DesktopNavigation({
  currentLocale,
  identity,
  labels,
  logoutAction,
  newOrderHref,
  pathname,
}: Omit<AppShellProps, "children"> & { newOrderHref: string; pathname: string }) {
  const activeItem = activeNavigationItem(pathname);
  const links: NavigationLink[] = [
    { key: "orders", href: "/orders", icon: "list_alt", label: labels.orders },
    { key: "add", href: newOrderHref, icon: "add_circle", label: labels.add },
    { key: "clients", href: "/clients", icon: "people", label: labels.clients },
    { key: "appointments", href: "/appointments", icon: "event", label: labels.appointments },
    { key: "stats", href: "/stats", icon: "bar_chart", label: labels.stats },
  ];

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r border-outline-variant bg-surface-container-lowest px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] md:flex lg:w-60 lg:px-3 print:hidden">
      <Link aria-label={identity.name} className="flex min-h-20 items-center justify-center rounded-xl bg-primary p-1 focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 lg:min-h-28 lg:p-3" href="/orders">
        <Image
          alt=""
          className="h-14 w-14 object-contain lg:h-20 lg:w-40"
          height={142}
          priority
          sizes="(min-width: 1024px) 160px, 72px"
          src={identity.logo.src}
          width={160}
        />
      </Link>

      <nav aria-label={labels.mainNavigation} className="mt-4 flex flex-1 flex-col gap-1">
        {links.map((link) => {
          const isActive = link.key === "stats" ? pathname === link.href : activeItem === link.key;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              aria-label={link.label}
              className={cx(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 py-1 text-[0.625rem] font-semibold transition lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-label-md focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2",
                isActive ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
              )}
              href={link.href}
              key={link.key}
            >
              <Icon name={link.icon} />
              <span className="w-full min-w-0 break-words whitespace-normal text-center leading-tight lg:truncate lg:text-left lg:leading-normal">{link.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-2 border-t border-outline-variant/60 pt-3 lg:block lg:space-y-2">
        <Link
          aria-current={activeItem === "settings" ? "page" : undefined}
          aria-label={labels.settings}
          className={cx(
            "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[0.625rem] font-semibold transition lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-label-md focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2",
            activeItem === "settings" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface",
          )}
          href="/settings"
        >
          <Icon name="settings" />
          <span className="w-full min-w-0 break-words whitespace-normal text-center leading-tight lg:truncate lg:text-left lg:leading-normal">{labels.settings}</span>
        </Link>
        <LocaleToggle currentLocale={currentLocale} label={labels.language} />
        <form className="w-full" action={async () => {
          try { clearClientRegistrationRecovery(window.sessionStorage); } catch { /* Logout must remain available when storage is blocked. */ }
          await logoutAction();
        }}>
          <button aria-label={labels.logout} className="flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[0.625rem] font-semibold lg:min-h-12 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-0 lg:text-label-md text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2" type="submit">
            <Icon name="logout" />
            <span className="w-full min-w-0 break-words whitespace-normal text-center leading-tight lg:truncate lg:text-left lg:leading-normal">{labels.logout}</span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function MobileNavigation({ labels, newOrderHref, pathname }: { labels: AppShellLabels; newOrderHref: string; pathname: string }) {
  const activeItem = activeNavigationItem(pathname);
  const links: NavigationLink[] = [
    { key: "orders", href: "/orders", icon: "list_alt", label: labels.orders },
    { key: "clients", href: "/clients", icon: "people", label: labels.clients },
    { key: "add", href: newOrderHref, icon: "add_circle", label: labels.add },
    { key: "appointments", href: "/appointments", icon: "event", label: labels.appointments },
    { key: "stats", href: "/stats", icon: "bar_chart", label: labels.stats },
  ];

  return (
    <nav
      aria-label={labels.mainNavigation}
      data-mobile-navigation=""
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant bg-surface-container-lowest pb-[max(0.25rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:hidden print:hidden"
    >
      <div className="mx-auto grid min-h-16 max-w-[640px] grid-cols-5 px-2 pt-1">
        {links.map((link) => (
          <MobileLink active={activeItem === link.key} featured={link.key === "add"} key={link.key} link={link} />
        ))}
      </div>
    </nav>
  );
}

function MobileLink({ active, featured, link }: { active: boolean; featured: boolean; link: NavigationLink }) {
  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[0.6875rem] font-semibold leading-3 transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-inset",
        active && !featured ? "text-primary" : "text-on-surface-variant hover:text-primary",
      )}
      href={link.href}
    >
      <span className={cx("flex items-center justify-center rounded-full", featured ? "size-10 bg-secondary-container text-on-secondary-container" : "size-7")}>
        <Icon className="size-[1.125rem]" name={link.icon} />
      </span>
      <span className="max-w-full truncate">{link.label}</span>
    </Link>
  );
}

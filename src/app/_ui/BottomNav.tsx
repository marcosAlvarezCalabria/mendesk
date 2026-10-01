import Link from "next/link";

import { cx } from "@/app/_ui/classNames";
import { Icon } from "@/app/_ui/Icon";
import { dictionaries, type DictKey } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/getLocale";
import { t } from "@/i18n/t";

type BottomNavProps = {
  active?: "orders" | "add" | "archive";
  className?: string;
};

const items: readonly { key: "orders" | "add" | "archive"; labelKey: DictKey; icon: string; href: string; featured: boolean }[] = [
  { key: "orders", labelKey: "nav.orders", icon: "list_alt", href: "/orders", featured: false },
  { key: "add", labelKey: "nav.addNew", icon: "add_circle", href: "/orders/new", featured: true },
  { key: "archive", labelKey: "nav.archive", icon: "archive", href: "/orders?view=collected", featured: false },
];

export async function BottomNav({ active = "orders", className }: BottomNavProps) {
  const locale = await getLocale();
  const dict = dictionaries[locale];

  return (
    <nav className={cx("fixed inset-x-0 bottom-0 z-20 border-t border-outline-variant bg-background/95 shadow-[0_-4px_20px_0_rgba(0,0,0,0.04)] backdrop-blur md:hidden", className)} aria-label="Main navigation">
      <div className="mx-auto grid min-h-16 max-w-[720px] grid-cols-3 px-margin-mobile py-2">
        {items.map((item) => {
          const isActive = item.key === active;
          const isFeatured = item.featured;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cx(
                "mx-auto inline-flex min-h-touch-target-min min-w-20 flex-col items-center justify-center gap-1 rounded-full px-3 text-label-sm transition focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background",
                isFeatured ? "bg-secondary-container text-on-secondary-container" : "text-on-surface-variant hover:bg-surface-container-low",
                isActive && !isFeatured ? "bg-surface-container text-primary" : undefined,
              )}
              href={item.href}
              key={item.key}
            >
              <Icon name={item.icon} />
              <span>{t(dict, item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

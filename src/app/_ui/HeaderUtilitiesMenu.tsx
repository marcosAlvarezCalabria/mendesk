"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Icon } from "@/app/_ui/Icon";
import { clearClientRegistrationRecovery } from "@/app/clients/new/clientRegistrationRecovery";

type HeaderUtilitiesMenuProps = {
  labels: {
    more: string;
    settings: string;
    logout: string;
  };
  logoutAction: () => Promise<void>;
};

export function HeaderUtilitiesMenu({ labels, logoutAction }: HeaderUtilitiesMenuProps) {
  const pathname = usePathname();
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (detailsRef.current) {
      detailsRef.current.open = false;
    }
  }, [pathname]);

  return (
    <details className="group relative" ref={detailsRef}>
      <summary
        aria-label={labels.more}
        className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-full border border-outline-variant bg-surface-container-lowest text-primary transition hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background group-open:bg-primary group-open:text-on-primary [&::-webkit-details-marker]:hidden"
      >
        <Icon className="size-[1.125rem]" name="more_horiz" />
      </summary>

      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-60 rounded-xl border border-outline-variant bg-surface-container-lowest p-2 shadow-[0_12px_28px_rgba(31,27,23,0.16)]">
        <Link aria-current={pathname === "/settings" ? "page" : undefined} className={menuItemClassName} href="/settings">
          <Icon name="settings" />
          <span>{labels.settings}</span>
        </Link>
        <form action={async () => {
          try { clearClientRegistrationRecovery(window.sessionStorage); } catch { /* Logout must remain available when storage is blocked. */ }
          await logoutAction();
        }}>
          <button className={menuItemClassName} type="submit">
            <Icon name="logout" />
            <span>{labels.logout}</span>
          </button>
        </form>
      </div>
    </details>
  );
}

const menuItemClassName =
  "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-label-md text-on-surface-variant transition hover:bg-surface-container-low hover:text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-inset";

import type { ReactNode } from "react";

type IconProps = {
  name: string;
  className?: string;
  "aria-hidden"?: boolean;
};

const ICONS: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  search_off: (
    <>
      <path d="M8.5 4.7A7 7 0 0 1 18 11c0 1.4-.4 2.7-1.1 3.8" />
      <path d="M14.8 16.9A7 7 0 0 1 4 11c0-1.1.3-2.2.7-3.1M16 16l4 4M3 3l18 18" />
    </>
  ),
  cloud_off: (
    <>
      <path d="M17.5 19H6a4 4 0 0 1-.9-7.9A7 7 0 0 1 17.8 9" />
      <path d="M18.8 13.2A3.5 3.5 0 0 1 18 20M3 3l18 18" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  arrow_back: <path d="M20 12H5m7-7-7 7 7 7" />,
  arrow_forward: <path d="M5 12h14m-6-6 6 6-6 6" />,
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
    </>
  ),
  fact_check: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="m7 9 1.5 1.5L11 8M14 9h3m-3 5h3M7 14h4" />
    </>
  ),
  login: (
    <>
      <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5m5 5H3" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
      <path d="m14 17 5-5-5-5m5 5H9" />
    </>
  ),
  checkroom: (
    <>
      <path d="M10 5a2 2 0 1 1 2 2v2" />
      <path d="m12 9 8 6v3H4v-3l8-6Z" />
    </>
  ),
  list_alt: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="4" />
      <path d="M7 8h.01M10 8h7M7 12h.01M10 12h7M7 16h.01M10 16h7" />
    </>
  ),
  people: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  bar_chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
    </>
  ),
  lock: (
    <>
      <rect height="11" rx="2" width="16" x="4" y="10" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  more_horiz: (
    <>
      <circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" />
    </>
  ),
  add_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  archive: (
    <>
      <path d="M4 7h16v12H4zM3 4h18v3H3z" />
      <path d="M12 10v6m-3-3 3 3 3-3" />
    </>
  ),
  event: (
    <>
      <rect height="16" rx="2" width="18" x="3" y="5" />
      <path d="M7 3v4m10-4v4M3 10h18M8 14h3v3H8z" />
    </>
  ),
  print: (
    <>
      <path d="M7 9V3h10v6M7 18H5a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M7 14h10v7H7zM17 12h.01" />
    </>
  ),
  chat: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />
      <path d="M7 12h.01M12 12h.01M17 12h.01" />
    </>
  ),
  reviews: (
    <>
      <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />
      <path d="m12 7 1.3 2.6 2.9.4-2.1 2 .5 2.9-2.6-1.4-2.6 1.4.5-2.9-2.1-2 2.9-.4L12 7Z" />
    </>
  ),
  check_circle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 2.5 2.5L16 9" />
    </>
  ),
  inventory_2: (
    <>
      <path d="M4 7h16v14H4zM3 3h18v4H3z" />
      <path d="M9 11h6" />
    </>
  ),
  cancel: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6m0-6-6 6" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16M9 7V4h6v3m-9 0 1 14h10l1-14M10 11v6m4-6v6" />
    </>
  ),
};

const FALLBACK_ICON = <circle cx="12" cy="12" r="7" />;

export function Icon({ name, className = "", "aria-hidden": ariaHidden = true }: IconProps) {
  return (
    <svg
      aria-hidden={ariaHidden}
      className={`icon ${className}`.trim()}
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      {ICONS[name] ?? FALLBACK_ICON}
    </svg>
  );
}

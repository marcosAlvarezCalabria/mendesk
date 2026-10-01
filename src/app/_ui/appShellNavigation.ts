import { safeNewOrderReturnTo, withReturnTo } from "@/app/routeContext";

export type NavigationItemKey = "orders" | "add" | "clients" | "appointments" | "stats";

const PUBLIC_PATH_PREFIXES = ["/login", "/offline", "/kiosk"] as const;

export function isShellPath(pathname: string): boolean {
  return !PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function activeNavigationItem(pathname: string): NavigationItemKey | null {
  if (pathname === "/orders/new") {
    return "add";
  }

  if (pathname === "/orders" || pathname.startsWith("/orders/")) {
    return "orders";
  }

  if (pathname === "/clients" || pathname.startsWith("/clients/")) {
    return "clients";
  }

  if (pathname === "/appointments" || pathname.startsWith("/appointments/")) {
    return "appointments";
  }

  if (pathname === "/stats") {
    return "stats";
  }

  return null;
}

export function shouldShowMobileNavigation(pathname: string): boolean {
  return isShellPath(pathname);
}

export function buildNewOrderHref(pathname: string, query: string): string {
  const returnTo = pathname === "/orders/new"
    ? safeNewOrderReturnTo(new URLSearchParams(query).get("returnTo"))
    : safeNewOrderReturnTo(query ? `${pathname}?${query}` : pathname);

  return withReturnTo("/orders/new", returnTo);
}

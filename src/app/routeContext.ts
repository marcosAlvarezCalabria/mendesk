import { safeNextPath } from "@/app/safeNextPath";

const ROUTE_BASE_URL = "https://panel.invalid";

export function withReturnTo(destination: string, returnTo: string): string {
  const url = new URL(destination, ROUTE_BASE_URL);
  url.searchParams.set("returnTo", returnTo);

  return `${url.pathname}${url.search}`;
}
export function safeNewOrderReturnTo(value: unknown): string {
  for (const pathname of ["/orders", "/clients", "/appointments", "/stats"] as const) {
    if (safeReturnTo(value, pathname, "") !== "") return value as string;
  }
  return "/orders";
}


export function safeOrdersReturnTo(value: unknown): string {
  return safeReturnTo(value, "/orders", "/orders");
}

export function safeClientDetailReturnTo(value: unknown, clientId: string): string {
  const fallback = `/clients/${encodeURIComponent(clientId)}`;

  if (typeof value !== "string" || !hasSafeRelativeShape(value)) return fallback;

  try {
    const url = new URL(value, ROUTE_BASE_URL);
    const nestedReturnTo = url.searchParams.getAll("returnTo");
    if (
      url.origin !== ROUTE_BASE_URL
      || url.pathname !== fallback
      || [...url.searchParams.keys()].some((key) => key !== "returnTo")
      || nestedReturnTo.length > 1
      || (nestedReturnTo.length === 1 && safeClientsReturnTo(nestedReturnTo[0]) !== nestedReturnTo[0])
    ) return fallback;
  } catch {
    return fallback;
  }

  return value;
}

export function safeOrderReturnTo(value: unknown, clientId: string): string {
  const clientFallback = `/clients/${encodeURIComponent(clientId)}`;
  const safeClientReturn = safeClientDetailReturnTo(value, clientId);
  return safeClientReturn !== clientFallback || value === clientFallback ? safeClientReturn : safeOrdersReturnTo(value);
}

export function safeClientsReturnTo(value: unknown): string {
  return safeReturnTo(value, "/clients", "/clients");
}

export function safeNewClientReturnTo(value: unknown): string {
  const appointmentReturn = safeReturnTo(value, "/appointments/new", "");
  return appointmentReturn || safeClientsReturnTo(value);
}

export function safeOrderDetailReturnTo(value: unknown, orderNumber: string): string {
  const fallback = `/orders/${orderNumber}`;

  return safeReturnTo(value, fallback, fallback);
}

function safeReturnTo(value: unknown, expectedPathname: string, fallback: string): string {
  if (typeof value !== "string" || !hasSafeRelativeShape(value)) {
    return fallback;
  }

  try {
    const url = new URL(value, ROUTE_BASE_URL);

    if (
      url.origin !== ROUTE_BASE_URL
      || url.pathname !== expectedPathname
      || safeNextPath(url.pathname) !== url.pathname
    ) {
      return fallback;
    }
  } catch {
    return fallback;
  }

  return value;
}

function hasSafeRelativeShape(value: string): boolean {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("#")) {
    return false;
  }

  const queryIndex = value.indexOf("?");
  const pathname = queryIndex === -1 ? value : value.slice(0, queryIndex);

  if (/%(?:2f|5c)/i.test(pathname)) {
    return false;
  }

  try {
    return !/[\u0000-\u001f\u007f]/u.test(decodeURIComponent(value));
  } catch {
    return false;
  }
}

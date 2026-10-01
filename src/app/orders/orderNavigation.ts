import { safeOrderReturnTo, safeOrdersReturnTo, withReturnTo } from "@/app/routeContext";

export function buildOrderDetailHref(orderNumber: string, returnTo: unknown, clientId?: string): string {
  const safeReturnTo = clientId
    ? safeOrderReturnTo(returnTo, clientId)
    : safeOrdersReturnTo(returnTo);

  return withReturnTo(`/orders/${orderNumber}`, safeReturnTo);
}

export function buildOrderTicketsHref(orderNumber: string, returnTo: unknown, clientId?: string): string {
  const detailHref = buildOrderDetailHref(orderNumber, returnTo, clientId);

  return withReturnTo(`/orders/${orderNumber}/tickets`, detailHref);
}

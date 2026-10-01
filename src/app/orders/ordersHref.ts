export type OrdersHrefParams = { view?: string; date?: string; q?: string; page?: number };

export function buildOrdersHref(params: OrdersHrefParams & { anchor?: string }): string {
  const searchParams = new URLSearchParams();

  if (params.view && params.view !== "active") {
    searchParams.set("view", params.view);
  }

  if (params.date && params.date !== "all") {
    searchParams.set("date", params.date);
  }

  const query = params.q?.trim() ?? "";
  if (query) {
    searchParams.set("q", query);
  }

  if (params.page && params.page > 1) {
    searchParams.set("page", String(params.page));
  }

  if (params.anchor) {
    searchParams.set("anchor", params.anchor);
  }

  const queryString = searchParams.toString();

  return queryString ? `/orders?${queryString}` : "/orders";
}

export function parseOrdersPage(value: string | undefined): number {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

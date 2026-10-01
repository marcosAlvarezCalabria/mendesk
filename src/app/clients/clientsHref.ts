export type ClientsHrefState = {
  q?: string;
  page?: number;
  anchor?: string;
};

const CLIENT_ANCHOR_PATTERN = /^client-[A-Za-z0-9-]+$/;

export function buildClientsHref({ q, page = 1, anchor }: ClientsHrefState): string {
  const params = new URLSearchParams();
  const query = q?.trim();

  if (query) {
    params.set("q", query);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const safeAnchor = parseClientsAnchor(anchor);
  if (safeAnchor) {
    params.set("anchor", safeAnchor);
  }

  const queryString = params.toString();
  return queryString ? `/clients?${queryString}` : "/clients";
}

export function parseClientsPage(value: string | undefined): number {
  if (!value || !/^\d+$/.test(value)) {
    return 1;
  }

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function clientAnchor(clientId: string): string {
  return `client-${clientId}`;
}

export function parseClientsAnchor(value: string | undefined): string | undefined {
  return value && CLIENT_ANCHOR_PATTERN.test(value) ? value : undefined;
}

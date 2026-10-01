import { describe, expect, it } from "vitest";

import { buildClientsHref, clientAnchor, parseClientsAnchor, parseClientsPage } from "@/app/clients/clientsHref";

describe("buildClientsHref", () => {
  it("preserves search, page and the logical client anchor", () => {
    expect(buildClientsHref({ q: "Ada Lovelace", page: 2, anchor: "client-client-1" })).toBe(
      "/clients?q=Ada+Lovelace&page=2&anchor=client-client-1",
    );
  });

  it("omits empty search, the first page and an invalid anchor", () => {
    expect(buildClientsHref({ q: "  ", page: 1, anchor: "orders-row-1" })).toBe("/clients");
  });
});

describe("parseClientsPage", () => {
  it.each([undefined, "", "0", "-1", "1.5", "not-a-page"])("falls back to page one for %s", (value) => {
    expect(parseClientsPage(value)).toBe(1);
  });

  it("accepts a positive integer", () => {
    expect(parseClientsPage("3")).toBe(3);
  });
});

describe("client anchors", () => {
  it("builds and accepts a logical DOM anchor", () => {
    const anchor = clientAnchor("123e4567-e89b-12d3-a456-426614174000");

    expect(anchor).toBe("client-123e4567-e89b-12d3-a456-426614174000");
    expect(parseClientsAnchor(anchor)).toBe(anchor);
  });

  it.each([undefined, "", "client-", "order-client-1", "client-one/two"])("rejects an invalid anchor: %s", (value) => {
    expect(parseClientsAnchor(value)).toBeUndefined();
  });
});

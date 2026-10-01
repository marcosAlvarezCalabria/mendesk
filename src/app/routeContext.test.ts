import { describe, expect, it } from "vitest";

import {
  safeClientDetailReturnTo,
  safeClientsReturnTo,
  safeNewClientReturnTo,
  safeOrderReturnTo,
  safeNewOrderReturnTo,
  safeOrderDetailReturnTo,
  safeOrdersReturnTo,
  withReturnTo,
} from "@/app/routeContext";

describe("safeNewClientReturnTo", () => {
  it("accepts the New appointment surface and rejects unrelated routes", () => {
    expect(safeNewClientReturnTo("/appointments/new")).toBe("/appointments/new");
    expect(safeNewClientReturnTo("/orders/new")).toBe("/clients");
  });
});

describe("withReturnTo", () => {
  it("adds an encoded return destination with its complete query", () => {
    expect(
      withReturnTo(
        "/orders/260819-0142",
        "/orders?view=ready&q=Ada+Lovelace&page=2&anchor=order-1",
      ),
    ).toBe(
      "/orders/260819-0142?returnTo=%2Forders%3Fview%3Dready%26q%3DAda%2BLovelace%26page%3D2%26anchor%3Dorder-1",
    );
  });

  it("preserves an existing destination query", () => {
    expect(withReturnTo("/orders/260819-0142?panel=payment", "/clients?q=Ada&page=2")).toBe(
      "/orders/260819-0142?panel=payment&returnTo=%2Fclients%3Fq%3DAda%26page%3D2",
    );
  });

  it("replaces an existing returnTo instead of duplicating it", () => {
    expect(withReturnTo("/orders/260819-0142?returnTo=%2Forders", "/clients")).toBe(
      "/orders/260819-0142?returnTo=%2Fclients",
    );
  });
});

describe("safeNewOrderReturnTo", () => {
  it.each([
    "/orders?view=ready&page=2&anchor=order-1",
    "/clients?q=Ada&page=2&anchor=client-1",
    "/appointments?week=2026-09-07",
    "/stats?range=this-month",
  ])("accepts a primary workspace origin with its query: %s", (value) => {
    expect(safeNewOrderReturnTo(value)).toBe(value);
  });

  it.each([
    undefined,
    ["/clients"],
    "/orders/new",
    "/clients/client-1",
    "/login",
    "//evil.example/orders",
    "https://evil.example/orders",
    "/stats#chart",
  ])("falls back from an unsafe New Order origin %#", (value) => {
    expect(safeNewOrderReturnTo(value)).toBe("/orders");
  });
});

describe("safeOrdersReturnTo", () => {
  it.each([
    "/orders",
    "/orders?view=ready&q=Ada&page=2&anchor=order-1",
    "/orders?q=%D0%9B%D1%8E%D0%B4%D0%BC%D0%B8%D0%BB%D0%B0",
  ])("accepts the exact Orders surface with its query: %s", (value) => {
    expect(safeOrdersReturnTo(value)).toBe(value);
  });

  it.each([
    undefined,
    null,
    ["/orders"],
    "orders",
    "/orders/new",
    "/orders/260819-0142",
    "/clients",
    "/login",
    "//evil.example/orders",
    "https://evil.example/orders",
    "/orders/%2f%2fevil.example",
    "/orders/%5cevil.example",
    "/orders/%E0%A4%A",
    "/orders#order-1",
  ])("falls back from an unsafe or cross-surface Orders origin %#", (value) => {
    expect(safeOrdersReturnTo(value)).toBe("/orders");
  });
});

describe("safeClientsReturnTo", () => {
  it.each([
    "/clients",
    "/clients?q=Ada&page=2&anchor=client-1",
  ])("accepts the exact Clients surface with its query: %s", (value) => {
    expect(safeClientsReturnTo(value)).toBe(value);
  });

  it.each([
    undefined,
    ["/clients"],
    "/clients/new",
    "/clients/123e4567-e89b-12d3-a456-426614174000",
    "/orders",
    "/kiosk",
    "//evil.example/clients",
    "/clients/%2f%2fevil.example",
    "/clients#client-1",
  ])("falls back from an unsafe or cross-surface Clients origin %#", (value) => {
    expect(safeClientsReturnTo(value)).toBe("/clients");
  });
});

describe("safeOrderDetailReturnTo", () => {
  const orderNumber = "260819-0142";

  it.each([
    "/orders/260819-0142",
    "/orders/260819-0142?returnTo=%2Forders%3Fview%3Dready%26anchor%3Dorder-1",
  ])("accepts the exact order detail with its query: %s", (value) => {
    expect(safeOrderDetailReturnTo(value, orderNumber)).toBe(value);
  });

  it.each([
    undefined,
    ["/orders/260819-0142"],
    "/orders",
    "/orders/260819-0143",
    "/orders/260819-0142/tickets",
    "/clients",
    "//evil.example/orders/260819-0142",
    "/orders/260819-0142/%5cevil.example",
    "/orders/260819-0142#payment",
  ])("falls back from an unsafe or cross-order detail origin %#", (value) => {
    expect(safeOrderDetailReturnTo(value, orderNumber)).toBe("/orders/260819-0142");
  });
});

describe("safeClientDetailReturnTo", () => {
  const clientId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts only the exact client detail and preserves its Clients origin", () => {
    const value = `/clients/${clientId}?returnTo=%2Fclients%3Fq%3DAda%26page%3D2%26anchor%3Dclient-1`;

    expect(safeClientDetailReturnTo(value, clientId)).toBe(value);
  });

  it.each([
    `/clients/223e4567-e89b-12d3-a456-426614174000`,
    `/clients/${clientId}?returnTo=https%3A%2F%2Fevil.example`,
    `/clients/${clientId}?returnTo=%2Forders`,
    `//evil.example/clients/${clientId}`,
  ])("falls back from another client or an unsafe nested origin: %s", (value) => {
    expect(safeClientDetailReturnTo(value, clientId)).toBe(`/clients/${clientId}`);
  });
});

describe("safeOrderReturnTo", () => {
  const clientId = "123e4567-e89b-12d3-a456-426614174000";

  it("accepts either Orders or the order client's exact detail", () => {
    expect(safeOrderReturnTo("/orders?view=ready", clientId)).toBe("/orders?view=ready");
    expect(
      safeOrderReturnTo(
        `/clients/${clientId}?returnTo=%2Fclients%3Fq%3DAda`,
        clientId,
      ),
    ).toBe(`/clients/${clientId}?returnTo=%2Fclients%3Fq%3DAda`);
  });

  it("rejects another client's detail", () => {
    expect(
      safeOrderReturnTo("/clients/223e4567-e89b-12d3-a456-426614174000", clientId),
    ).toBe("/orders");
  });
});

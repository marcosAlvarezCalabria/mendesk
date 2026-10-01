import { describe, expect, it } from "vitest";

import { safeNextPath } from "@/app/safeNextPath";

describe("safeNextPath", () => {
  it.each([
    "/orders",
    "/orders?view=ready&q=Ada&page=2",
    "/orders/new",
    "/orders/260819-0142",
    "/orders/260819-0142?returnTo=%2Forders",
    "/orders/260819-0142/tickets",
    "/orders/260819-0142/tickets?returnTo=%2Forders%2F260819-0142",
    "/clients",
    "/clients/new",
    "/clients/123e4567-e89b-12d3-a456-426614174000",
    "/appointments",
    "/appointments/new",
    "/appointments/history",
    "/appointments/123e4567-e89b-12d3-a456-426614174000",
    "/stats?preset=today",
  ])("preserves the private relative destination %s", (destination) => {
    expect(safeNextPath(destination)).toBe(destination);
  });

  it.each([
    undefined,
    null,
    "",
    ["/orders"],
    "orders/260819-0142",
    "//evil.example/orders/260819-0142",
    "https://evil.example/orders/260819-0142",
    "http://evil.example",
    "javascript:alert(1)",
    "\\\\evil.example\\orders",
    "/orders\\260819-0142",
    "/login",
    "/offline",
    "/kiosk",
    "/lock",
    "/settings",
    "/dashboard",
    "/api/clients/search",
    "/_next/static/app.js",
    "/unknown",
    "/orders/%2f%2fevil.example",
    "/orders/%5cevil.example",
    "/orders/%E0%A4%A",
    "/orders/260819-0142#payment",
    "/orders/260819-0142\r\nLocation:https://evil.example",
    "/orders/260819-0142\0",
  ])("falls back for an unsafe or unsupported destination %#", (destination) => {
    expect(safeNextPath(destination)).toBe("/orders");
  });
});

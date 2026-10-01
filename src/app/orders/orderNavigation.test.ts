import { describe, expect, it } from "vitest";

import { buildOrderDetailHref, buildOrderTicketsHref } from "@/app/orders/orderNavigation";

describe("order navigation context", () => {
  const origin = "/orders?view=ready&q=Ada&page=2&anchor=order-1";

  it("carries the complete Orders origin into the detail", () => {
    expect(buildOrderDetailHref("260819-0142", origin)).toBe(
      "/orders/260819-0142?returnTo=%2Forders%3Fview%3Dready%26q%3DAda%26page%3D2%26anchor%3Dorder-1",
    );
  });

  it("carries the detail and its Orders origin into tickets", () => {
    expect(buildOrderTicketsHref("260819-0142", origin)).toBe(
      "/orders/260819-0142/tickets?returnTo=%2Forders%2F260819-0142%3FreturnTo%3D%252Forders%253Fview%253Dready%2526q%253DAda%2526page%253D2%2526anchor%253Dorder-1",
    );
  });

  it("falls back safely when a detail is opened directly", () => {
    expect(buildOrderDetailHref("260819-0142", "https://evil.example/orders")).toBe(
      "/orders/260819-0142?returnTo=%2Forders",
    );
    expect(buildOrderTicketsHref("260819-0142", undefined)).toBe(
      "/orders/260819-0142/tickets?returnTo=%2Forders%2F260819-0142%3FreturnTo%3D%252Forders",
    );
  });

  it("carries a client detail and its Clients origin through detail and tickets", () => {
    const clientId = "123e4567-e89b-12d3-a456-426614174000";
    const clientOrigin = `/clients/${clientId}?returnTo=%2Fclients%3Fq%3DAda%26page%3D2`;

    expect(buildOrderDetailHref("260819-0142", clientOrigin, clientId)).toBe(
      "/orders/260819-0142?returnTo=%2Fclients%2F123e4567-e89b-12d3-a456-426614174000%3FreturnTo%3D%252Fclients%253Fq%253DAda%2526page%253D2",
    );
    expect(buildOrderTicketsHref("260819-0142", clientOrigin, clientId)).toBe(
      "/orders/260819-0142/tickets?returnTo=%2Forders%2F260819-0142%3FreturnTo%3D%252Fclients%252F123e4567-e89b-12d3-a456-426614174000%253FreturnTo%253D%25252Fclients%25253Fq%25253DAda%252526page%25253D2",
    );
  });
});

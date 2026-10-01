import { describe, expect, it } from "vitest";

import { activeNavigationItem, buildNewOrderHref, isShellPath, shouldShowMobileNavigation } from "@/app/_ui/appShellNavigation";

describe("app shell navigation", () => {
  it.each(["/login", "/offline", "/kiosk", "/kiosk/complete"])("keeps %s outside the authenticated shell", (pathname) => {
    expect(isShellPath(pathname)).toBe(false);
  });

  it.each(["/orders", "/orders/260819-0142", "/clients", "/appointments", "/stats"])("shows the authenticated shell on %s", (pathname) => {
    expect(isShellPath(pathname)).toBe(true);
  });

  it.each([
    ["/orders", "orders"],
    ["/orders/260819-0142", "orders"],
    ["/orders/new", "add"],
    ["/clients/client-1", "clients"],
    ["/appointments", "appointments"],
    ["/stats", "stats"],
  ] as const)("marks %s as %s", (pathname, item) => {
    expect(activeNavigationItem(pathname)).toBe(item);
  });

  it.each(["/orders", "/clients", "/orders/new", "/appointments", "/stats"])(
    "shows the mobile navigation on the primary destination %s",
    (pathname) => {
      expect(shouldShowMobileNavigation(pathname)).toBe(true);
    },
  );

  it.each(["/orders/260819-0142", "/orders/260819-0142/tickets", "/clients/client-1", "/clients/new", "/appointments/new", "/appointments/history", "/appointments/appointment-1", "/dashboard"])(
    "keeps the mobile navigation available on the private route %s",
    (pathname) => {
      expect(shouldShowMobileNavigation(pathname)).toBe(true);
    },
  );

  it.each(["/login", "/offline", "/kiosk", "/kiosk/complete"])(
    "keeps the mobile navigation off the public route %s",
    (pathname) => {
      expect(shouldShowMobileNavigation(pathname)).toBe(false);
    },
  );

  it.each([
    ["/orders", "view=all&q=anna&page=2&anchor=order-42", "/orders/new?returnTo=%2Forders%3Fview%3Dall%26q%3Danna%26page%3D2%26anchor%3Dorder-42"],
    ["/clients", "q=anna&page=3&anchor=client-7", "/orders/new?returnTo=%2Fclients%3Fq%3Danna%26page%3D3%26anchor%3Dclient-7"],
    ["/appointments", "week=next", "/orders/new?returnTo=%2Fappointments%3Fweek%3Dnext"],
    ["/stats", "range=month", "/orders/new?returnTo=%2Fstats%3Frange%3Dmonth"],
  ])("keeps the exact safe origin when New is opened from %s", (pathname, query, expected) => {
    expect(buildNewOrderHref(pathname, query)).toBe(expected);
  });

  it.each([
    ["returnTo=%2Forders%3Fpage%3D2", "/orders/new?returnTo=%2Forders%3Fpage%3D2"],
    ["returnTo=https%3A%2F%2Fevil.example", "/orders/new?returnTo=%2Forders"],
  ])("keeps a safe origin while already creating an order", (query, expected) => {
    expect(buildNewOrderHref("/orders/new", query)).toBe(expected);
  });
});

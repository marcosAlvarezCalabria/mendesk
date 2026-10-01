import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import OrdersPage from "./page";
const fixture = vi.hoisted(() => ({ token: vi.fn(), reader: vi.fn(), redirect: vi.fn(), auth: vi.fn(), result: vi.fn() }));
vi.stubGlobal("React", React);
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: fixture.token }));
vi.mock("@/composition/directus", () => ({ makeOrdersOverviewReader: fixture.reader }));
vi.mock("@/application/useCases/GetOrdersOverview", () => ({ GetOrdersOverview: class { execute = fixture.result; } }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("@/app/authRedirect", () => ({ redirectToLoginForAuthError: fixture.auth }));
vi.mock("next/navigation", () => ({ redirect: fixture.redirect }));
vi.mock("./OrdersOverviewClient", () => ({ OrdersOverviewClient: () => null }));
vi.mock("@/app/sync/ReadSyncMarker", () => ({ ReadSyncMarker: "read-marker" }));
beforeEach(() => { vi.clearAllMocks(); fixture.token.mockResolvedValue("test-session"); fixture.result.mockResolvedValue({ asOf: "2026-07-01T12:00:00Z", counts: { status: "ready" }, toCollect: { status: "ready" }, list: { status: "ready" } }); });
function hasMarker(value: unknown): boolean {
  if (!React.isValidElement<{ children?: React.ReactNode }>(value)) return false;
  return value.type === "read-marker" || React.Children.toArray(value.props.children).some(hasMarker);
}
describe("orders server read boundary", () => {
  it("uses the new reader and marks only completed readings", async () => {
    const page = await OrdersPage({ searchParams: Promise.resolve({ attention: "overdue", q: "Ada", page: "2" }) });
    expect(fixture.reader).toHaveBeenCalledWith("test-session");
    expect(fixture.result).toHaveBeenCalledWith(expect.objectContaining({ selection: { kind: "attention", value: "overdue" }, search: "Ada", page: 2 }));
    expect(hasMarker(page)).toBe(true);
  });
  it("does not acknowledge a partial read failure to R05", async () => {
    fixture.result.mockResolvedValue({ counts: { status: "ready" }, toCollect: { status: "error" }, list: { status: "ready" } });
    expect(hasMarker(await OrdersPage({ searchParams: Promise.resolve({}) }))).toBe(false);
  });
  it("retains the safe full return URL on auth failure", async () => {
    const failure = new Error("auth"); fixture.result.mockRejectedValue(failure); fixture.auth.mockRejectedValue(failure);
    await expect(OrdersPage({ searchParams: Promise.resolve({ view: "ready", q: "Ada", page: "2" }) })).rejects.toBe(failure);
    expect(fixture.auth).toHaveBeenCalledWith(failure, "/orders?view=ready&q=Ada&page=2");
  });
});

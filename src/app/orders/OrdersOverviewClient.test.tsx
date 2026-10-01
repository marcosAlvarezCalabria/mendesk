import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { OrdersOverviewClient } from "./OrdersOverviewClient";
import type { OrdersOverview } from "@/application/dtos/OrdersOverview";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./OrderAnchorRestorer", () => ({ OrderAnchorRestorer: () => null, orderAnchor: (id: string) => `order-${id}` }));
vi.mock("./OrdersReadRetry", () => ({ OrdersReadRetry: ({ label }: { label: string }) => <button>{label}</button> }));
const overview: OrdersOverview = {
  asOf: "2026-07-01T12:00:00Z", counts: { status: "ready", data: { overdue: 30, dueToday: 2, dueTomorrow: 6, readyForPickup: 4, active: 42 } },
  toCollect: { status: "ready", data: { status: "ready", amountCents: 1234 } },
  list: { status: "ready", data: { totalCount: 42, page: 1, pageSize: 8, hasNextPage: true, items: [
    { id: "test", orderNumber: "260907-0001", clientName: "Fictitious client", status: "received", receivedDate: "2026-06-28T12:00:00Z", dueDate: "2026-06-30T12:00:00Z", garmentCount: 2, balance: { status: "ready", outstandingCents: 500, paidCents: 700 } },
  ] } },
};
describe("Today presentation", () => {
  it("shows tomorrow with the four global attention links, noninteractive money and real status plus overdue", () => {
    const html = renderToStaticMarkup(<OrdersOverviewClient overview={overview} params={{ selection: { kind: "active" }, q: "", page: 1 }} locale="en" />);
    expect(html).toContain("Active orders"); expect(html).toContain("42");
    expect(html).toContain("€12.34"); expect(html).toContain("To collect");
    expect(html).toContain("Received"); expect(html).toContain("1 day overdue");
    expect(html.match(/href="\/orders\?attention=/g)).toHaveLength(4);
    expect(html).toContain("Received 28 Jun 2026");
    expect(html).toContain("Due 30 Jun 2026");
    expect(html).toContain("Tomorrow"); expect(html).toContain("6");
    expect(html).not.toContain("Mark Ready");
    expect(html).toContain("returnTo="); expect(html).toContain("anchor");
  });
  it("keeps the four shortcuts visible on a restored filter and retains search in Show all", () => {
    const html = renderToStaticMarkup(<OrdersOverviewClient overview={overview} params={{ selection: { kind: "status", value: "ready" }, q: "Ada", page: 2 }} locale="en" />);
    expect(html).not.toContain("To collect");
    expect(html).toContain("Ready for pickup"); expect(html).toContain("Tomorrow");
    expect(html.match(/href="\/orders\?attention=/g)).toHaveLength(4);
    expect(html).toContain("Show all"); expect(html).toContain('href="/orders?q=Ada"');
  });
  it("keeps independent valid sections when a read fails without fake zero", () => {
    const html = renderToStaticMarkup(<OrdersOverviewClient overview={{ ...overview, toCollect: { status: "error" } }} params={{ selection: { kind: "active" }, q: "", page: 1 }} locale="en" />);
    expect(html).toContain("Fictitious client"); expect(html).toContain("Try again");
    expect(html).not.toContain("€0.00"); expect(html).not.toContain("€12.34");
  });
  it("shows affected orders instead of an unreliable total", () => {
    const html = renderToStaticMarkup(<OrdersOverviewClient overview={{ ...overview, toCollect: { status: "ready", data: { status: "inconsistent", issues: [{ orderId: "x", orderNumber: "260907-0010", reason: "overpaid" }] } } }} params={{ selection: { kind: "active" }, q: "", page: 1 }} locale="uk" />);
    expect(html).toContain("260907-0010"); expect(html).not.toContain("12,34");
  });
  it.each([
    { locale: "en" as const, expected: "Paid in full · €13.00 collected" },
    { locale: "uk" as const, expected: "Сплачено повністю · отримано 13,00 EUR" },
  ])("shows the amount actually collected for a paid order in $locale", ({ locale, expected }) => {
    const readyPage = overview.list.status === "ready" ? overview.list.data : neverPage();
    const readyOrder = readyPage.items[0] ?? neverOrder();
    const paidOverview: OrdersOverview = {
      ...overview,
      list: { status: "ready", data: {
        ...readyPage,
        items: [{ ...readyOrder, balance: { status: "ready", outstandingCents: 0, paidCents: 1300 } }],
      } },
    };
    const html = renderToStaticMarkup(<OrdersOverviewClient overview={paidOverview} params={{ selection: { kind: "active" }, q: "", page: 1 }} locale={locale} />);
    expect(html).toContain(expected);
  });
  it.each([
    ["received", "border-status-received"],
    ["ready", "border-status-ready"],
    ["collected", "border-status-collected"],
    ["cancelled", "border-status-cancelled"],
  ] as const)("emphasizes a %s order with a full status border", (status, borderClass) => {
    const readyPage = overview.list.status === "ready" ? overview.list.data : neverPage();
    const readyOrder = readyPage.items[0] ?? neverOrder();
    const emphasizedOverview: OrdersOverview = {
      ...overview,
      list: { status: "ready", data: {
        ...readyPage,
        items: [{ ...readyOrder, status, dueDate: "2026-07-05T12:00:00Z" }],
      } },
    };

    const html = renderToStaticMarkup(<OrdersOverviewClient overview={emphasizedOverview} params={{ selection: { kind: "active" }, q: "", page: 1 }} locale="en" />);

    expect(html).toContain("border-2");
    expect(html).toContain(borderClass);
    expect(html).not.toContain("border-l-status-");
  });
});
function neverPage(): never { throw new Error("Expected ready page"); }
function neverOrder(): never { throw new Error("Expected order"); }

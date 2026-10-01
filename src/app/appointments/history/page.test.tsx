import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listHistory: vi.fn() }));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: ({ title, backHref }: { title: string; backHref: string }) => <header><a href={backHref}>{title}</a></header> }));
vi.mock("@/app/_ui/Icon", () => ({ Icon: ({ name }: { name: string }) => <span>{name}</span> }));
vi.mock("@/app/sync/ReadSyncMarker", () => ({ ReadSyncMarker: () => null }));
vi.mock("@/composition/directus", () => ({ makeAppointmentHistoryReader: () => ({ listHistory: mocks.listHistory }) }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "token" }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));

import AppointmentHistoryPage from "./page";

describe("AppointmentHistoryPage", () => {
  beforeEach(() => mocks.listHistory.mockReset());

  it("renders terminal rows and preserves the view when opening details or loading earlier", async () => {
    mocks.listHistory.mockResolvedValue({
      items: [{
        id: "appointment-1",
        clientId: "client-1",
        clientName: "Mary",
        scheduledAt: new Date("2026-09-03T15:00:00.000Z"),
        status: "completed",
        notes: "Bridal consultation",
        linkedOrder: { id: "order-1", orderNumber: "260902-0145", status: "ready" },
      }],
      hasEarlier: true,
    });

    const html = renderToStaticMarkup(await AppointmentHistoryPage({
      searchParams: Promise.resolve({ q: "Mary", status: "completed" }),
    }));

    expect(html).toContain("Recent appointments · 1");
    expect(html).toContain("Mary");
    expect(html).toContain("260902-0145 · Ready");
    expect(html).toContain("min-h-11 shrink-0");
    expect(html).toContain("Bridal consultation");
    expect(html).toContain("260902-0145");
    expect(html).toContain("Completed");
    expect(html).toContain("returnTo=%2Fappointments%2Fhistory%3Fq%3DMary%26status%3Dcompleted");
    expect(html).toContain('href="/appointments/history?q=Mary&amp;status=completed&amp;page=2"');
  });

  it("distinguishes an empty history from filtered results", async () => {
    mocks.listHistory.mockResolvedValue({ items: [], hasEarlier: false });

    const empty = renderToStaticMarkup(await AppointmentHistoryPage({ searchParams: Promise.resolve({}) }));
    const filtered = renderToStaticMarkup(await AppointmentHistoryPage({ searchParams: Promise.resolve({ q: "Nobody" }) }));

    expect(empty).toContain("No completed or cancelled appointments yet.");
    expect(filtered).toContain("No appointments match this search or filter.");
    expect(filtered).toContain("Clear search and filters");
  });

  it("uses the localized deleted-client label when the relation is absent", async () => {
    mocks.listHistory.mockResolvedValue({
      items: [{ id: "appointment-2", clientName: "Deleted client", scheduledAt: new Date("2026-09-02T10:00:00.000Z"), status: "cancelled" }],
      hasEarlier: false,
    });

    const html = renderToStaticMarkup(await AppointmentHistoryPage({ searchParams: Promise.resolve({}) }));

    expect(html).toContain("Deleted client");
    expect(html).toContain("Cancelled");
  });
});

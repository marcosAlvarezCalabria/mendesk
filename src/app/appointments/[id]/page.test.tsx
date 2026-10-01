import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PhoneNumber } from "@/domain/values/PhoneNumber";

const mocks = vi.hoisted(() => ({ getById: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound: vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }), redirect: vi.fn(), useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: ({ title, backHref }: { title: string; backHref: string }) => <header><a href={backHref}>{title}</a></header> }));
vi.mock("@/app/sync/ReadSyncMarker", () => ({ ReadSyncMarker: () => null }));
vi.mock("@/app/appointments/AppointmentStatusActions", () => ({ AppointmentStatusActions: ({ currentStatus, texts }: { currentStatus: string; texts: { markCompleted: string; undoCompleted: string } }) => <button>{currentStatus === "completed" ? texts.undoCompleted : texts.markCompleted}</button> }));
vi.mock("@/composition/directus", () => ({ makeAppointmentRepository: () => ({ getById: mocks.getById }) }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "token" }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));

import AppointmentDetailPage from "./page";

describe("AppointmentDetailPage", () => {
  it("renders a scheduled appointment instead of returning 404", async () => {
    mocks.getById.mockResolvedValue({
      id: "appointment-1",
      client: { id: "client-1", name: "Melissa", phone: PhoneNumber.fromRaw("0852009225"), gdprConsent: true },
      clientId: "client-1",
      orderId: "order-1",
      scheduledAt: new Date("2026-09-12T08:00:00.000Z"),
      status: "scheduled",
      notes: "Fitting",
    });

    const html = renderToStaticMarkup(await AppointmentDetailPage({ params: Promise.resolve({ id: "appointment-1" }) }));

    expect(html).toContain("Melissa");
    expect(html).toContain("+353 85 200 9225");
    expect(html).toContain("Fitting");
    expect(html).toContain("Mark completed");
    expect(html).toContain("Edit appointment");
    expect(html).toContain('href="/appointments"');
  });

  it("keeps terminal appointments read-only", async () => {
    mocks.getById.mockResolvedValue({
      id: "appointment-2",
      client: { id: "client-1", name: "Melissa", phone: null, gdprConsent: true },
      scheduledAt: new Date("2026-09-12T08:00:00.000Z"),
      status: "completed",
    });

    const html = renderToStaticMarkup(await AppointmentDetailPage({ params: Promise.resolve({ id: "appointment-2" }) }));

    expect(html).toContain("Completed");
    expect(html).toContain("Undo completion");
    expect(html).not.toContain("Mark completed");
    expect(html).not.toContain("Edit appointment");
  });

  it("renders missing-client history safely and returns to the preserved History view", async () => {
    mocks.getById.mockResolvedValue({
      id: "appointment-3",
      client: undefined,
      order: { id: "order-1", orderNumber: { value: "260902-0145" }, status: { value: "ready" } },
      scheduledAt: new Date("2026-09-12T08:00:00.000Z"),
      status: "completed",
    });

    const html = renderToStaticMarkup(await AppointmentDetailPage({
      params: Promise.resolve({ id: "appointment-3" }),
      searchParams: Promise.resolve({ returnTo: "/appointments/history?q=Mary&status=cancelled&page=2" }),
    }));

    expect(html).toContain("Deleted client");
    expect(html).toContain('href="/appointments/history?q=Mary&amp;status=cancelled&amp;page=2"');
    expect(html).toContain("260902-0145");
    expect(html).toContain("Ready");
    expect(html).not.toContain("WhatsApp");
    expect(html).not.toContain("Edit appointment");
    expect(html).not.toContain("Undo completion");
  });
});

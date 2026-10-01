import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/application/useCases/GetClient", () => ({ GetClient: class { execute = mocks.get; } }));
vi.mock("@/composition/directus", () => ({ makeClientRepository: vi.fn() }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "test" }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));
vi.mock("@/app/sync/ReadSyncMarker", () => ({ ReadSyncMarker: () => null }));
vi.mock("@/app/_ui/AppHeader", () => ({ AppHeader: () => null }));
vi.mock("./AnonymizeClientForm", () => ({ AnonymizeClientForm: () => null }));
import Page from "./page";
import { Money } from "@/domain/values/Money";
import { OrderStatus } from "@/domain/values/OrderStatus";
describe("client history presentation", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const client = { id: "client-1", name: "Example", phone: { value: "353850000001" }, gdprConsent: true };
  const order = { id: "order-1", orderNumber: { value: "260907-0001" }, client, status: OrderStatus.READY, receivedDate: new Date("2026-06-28T12:00:00Z"), dueDate: new Date("2026-06-30T23:30:00Z"), payments: [], garments: [{ id: "g1", description: "Blue jacket", price: Money.fromEuros(15), photoId: "photo-1" }] };
  it("shows direct WhatsApp, garments, private photo and Dublin date without Ready overdue", async () => {
    mocks.get.mockResolvedValue({ client, orders: [order] });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: client.id }), searchParams: Promise.resolve({}) }));
    expect(html).toContain('href="https://wa.me/353850000001"'); expect(html).not.toContain("?text=");
    expect(html).toContain("Blue jacket"); expect(html).toContain("/api/photos/photo-1"); expect(html).toContain("01 Jul 2026");
    expect(html).toContain("Received 28 Jun 2026");
    expect(html).toContain("Due 01 Jul 2026");
    expect(html).not.toContain("Overdue"); expect(html).not.toContain("Danger zone");
  });
  it("does not silently turn historical overpayment into Paid", async () => {
    mocks.get.mockResolvedValue({ client, orders: [{ ...order, payments: [{ amount: Money.fromEuros(20) }] }] });
    const html = renderToStaticMarkup(await Page({ params: Promise.resolve({ id: client.id }), searchParams: Promise.resolve({}) }));
    expect(html).toContain("Financial data needs review");
  });
});

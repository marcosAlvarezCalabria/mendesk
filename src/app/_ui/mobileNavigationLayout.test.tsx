import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pathname: "/clients/new" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => mocks.pathname, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/sync/OrderSyncProvider", () => ({ OrderSyncProvider: ({ children }: { children: unknown }) => children, OrderSyncContext: null }));
vi.mock("@/app/sync/useMutationSync", () => ({ useMutationSync: () => ({ phase: "idle" }) }));
vi.mock("@/app/orders/[orderNumber]/status-actions", () => ({ changeStatusAction: vi.fn() }));
vi.mock("@/i18n/setLocale", () => ({ setLocale: vi.fn() }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useContext: () => null, useActionState: (_action: unknown, initial: unknown) => [initial, vi.fn(), false] }));
import { AppShell } from "./AppShell";
import { StatusBar, type StatusBarTexts } from "@/app/orders/[orderNumber]/StatusBar";
const labels = { mainNavigation: "Navigation", language: "Language", orders: "Orders", add: "New", clients: "Clients", appointments: "Agenda", stats: "Stats", logout: "Log out" };
const identity = { name: "Demo Atelier", shortName: "Demo", logo: { src: "/store/demo-atelier-mark.svg", alt: "Demo Atelier" } };
describe("persistent mobile navigation layout", () => {
  it.each(["/clients/new", "/clients/test", "/orders/test/tickets", "/appointments/history"])("reserves bottom space and renders navigation on %s", pathname => {
    mocks.pathname = pathname;
    const html = renderToStaticMarkup(<AppShell currentLocale="en" identity={identity} labels={labels} logoutAction={vi.fn()}><p>Content</p></AppShell>);
    expect(html).toContain("pb-[calc(4.25rem+env(safe-area-inset-bottom))]");
    expect(html).toContain("fixed inset-x-0 bottom-0");
    expect(html).toContain("data-mobile-navigation");
    expect(html).toContain("md:hidden print:hidden");
    expect(html).toContain("overflow-x-hidden overflow-x-clip");
  });
  it.each(["/login", "/offline", "/kiosk"])("leaves %s outside navigation", pathname => {
    mocks.pathname = pathname;
    expect(renderToStaticMarkup(<AppShell currentLocale="en" identity={identity} labels={labels} logoutAction={vi.fn()}><p>Public</p></AppShell>)).toBe("<p>Public</p>");
  });
  it("places fixed order actions above mobile navigation and preserves desktop positioning", () => {
    const html = renderToStaticMarkup(<StatusBar actions={[]} orderNumber="test" sourceStatus="collected" expectedDateUpdated="test" reviewWhatsappUrl="https://example.com" texts={{ ariaLabel: "Order actions", askReview: "Review" } as StatusBarTexts} />);
    expect(html).toContain("bottom-[calc(4.25rem+env(safe-area-inset-bottom))]");
    expect(html).toContain("md:bottom-0");
    expect(html).toContain("md:left-20");
    expect(html).toContain("lg:left-60");
  });
  it("uses the configured shop logo and keeps labels visible in the compact tablet rail", () => {
    mocks.pathname = "/orders";
    const html = renderToStaticMarkup(<AppShell currentLocale="en" identity={identity} labels={labels} logoutAction={vi.fn()}><p>Content</p></AppShell>);

    expect(html).toContain("md:pl-20");
    expect(html).toContain("lg:pl-60");
    expect(html).toContain("w-20");
    expect(html).toContain("lg:w-60");
    expect(html).toContain("demo-atelier-mark.svg");
    expect(html).toContain('aria-label="Demo Atelier"');
    expect(html).not.toContain("font-wordmark text-wordmark");
    expect(html).toContain("rounded-xl bg-primary");
    expect(html).toContain("text-[0.625rem]");
    expect(html).toContain("lg:text-label-md");
    expect(html).toContain("break-words whitespace-normal text-center leading-tight lg:truncate");
    expect(html).not.toContain("hidden lg:inline");
  });
});

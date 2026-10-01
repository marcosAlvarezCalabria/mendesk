import { renderToStaticMarkup } from "react-dom/server";
import { isValidElement, type ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/clients", useSearchParams: () => new URLSearchParams() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useMemo: () => ({ phase: () => "error", snapshot: () => 0, subscribe: vi.fn(), retry: vi.fn() }),
  useEffect: () => {}, useTransition: () => [false, vi.fn()], useSyncExternalStore: () => 0,
}));
import { OrderSyncProvider } from "./OrderSyncProvider";
import { AppShell } from "@/app/_ui/AppShell";
import { dictionaries } from "@/i18n/dictionaries";

describe("synchronization notice presentation", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("uses the stable default for legacy callers rather than reading the document language", () => {
    vi.stubGlobal("document", { documentElement: { lang: "uk" } });
    const html = renderToStaticMarkup(OrderSyncProvider({ children: null }));
    expect(html).toContain(dictionaries.en["sync.pending"]);
  });
  it.each(["en", "uk"] as const)("uses active %s even when the document still has the previous language", locale => {
    const previous = locale === "en" ? "uk" : "en";
    vi.stubGlobal("document", { documentElement: { lang: previous } });
    const html = renderToStaticMarkup(OrderSyncProvider({ children: null, locale }));
    expect(html).toContain(dictionaries[locale]["sync.pending"]);
    expect(html).toContain(dictionaries[locale]["sync.retry"]);
    expect(html).not.toContain(dictionaries[previous]["sync.pending"]);
  });
  it("keeps the recovery copy and action together in a compact centered row", () => {
    const html = renderToStaticMarkup(OrderSyncProvider({ children: null }));
    expect(html).toContain('class="mx-auto flex min-h-11 w-full min-w-0 max-w-[640px] items-center');
    expect(html).toContain("max-w-[45%]");
    expect(html).toContain("whitespace-normal");
  });
  it.each(["en", "uk"] as const)("places the provider and its notice inside the desktop content inset with %s", locale => {
    const tree = AppShell({ children: null, currentLocale: locale, logoutAction: vi.fn(), labels: { mainNavigation: "Navigation", language: "Language", orders: "Orders", add: "New", clients: "Clients", appointments: "Agenda", stats: "Stats", logout: "Log out" } });
    if (!isValidElement<{ className: string; children: ReactElement<{ locale: string }> }>(tree)) throw new Error("Expected the shell element");
    expect(tree.type).toBe("div");
    expect(tree.props.className).toContain("md:pl-20");
    expect(tree.props.className).toContain("lg:pl-60");
    expect(tree.props.children.type).toBe(OrderSyncProvider);
    expect(tree.props.children.props.locale).toBe(locale);
  });
});

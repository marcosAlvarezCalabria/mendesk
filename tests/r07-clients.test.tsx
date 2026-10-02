import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ usePathname: () => "/clients", useSearchParams: () => new URLSearchParams() }));
vi.mock("@/app/sync/OrderSyncProvider", () => ({ OrderSyncProvider: ({ children }: { children: unknown }) => children }));
vi.mock("@/app/_ui/LocaleToggle", () => ({ LocaleToggle: () => null }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useEffect: () => {}, useRef: () => ({ current: null }) }));
import { HeaderUtilitiesMenu } from "@/app/_ui/HeaderUtilitiesMenu";
import { AppShell } from "@/app/_ui/AppShell";
const identity = { name: "Demo Atelier", shortName: "Demo", logo: { src: "/store/demo-atelier-mark.svg", alt: "Demo Atelier" } };
type Tree = ReactElement<{ children?: unknown; action?: () => Promise<void> }>;
function findForm(node: unknown): Tree | undefined {
  if (Array.isArray(node)) {
    for (const child of node) { const found = findForm(child); if (found) return found; }
    return undefined;
  }
  if (!node || typeof node !== "object" || !("type" in node)) return undefined;
  const element = node as Tree;
  if (element.type === "form") return element;
  if (typeof element.type === "function") return findForm((element.type as (props: unknown) => unknown)(element.props));
  for (const child of [element.props.children].flat(Infinity)) { const found = findForm(child); if (found) return found; }
}
describe("client recovery logout wiring", () => {
  afterEach(() => vi.unstubAllGlobals());
  it.each(["header", "desktop"])("clears the generic marker before accepted %s logout", async surface => {
    const removeItem = vi.fn(); vi.stubGlobal("window", { sessionStorage: { removeItem } });
    const logoutAction = vi.fn(async () => { expect(removeItem).toHaveBeenCalledWith("mendesk:client-registration:recovery:v1"); });
    const tree = surface === "header" ? HeaderUtilitiesMenu({ labels: { more: "More", logout: "Log out" }, logoutAction })
      : AppShell({ children: null, currentLocale: "en", identity, logoutAction, labels: { mainNavigation: "Nav", language: "Language", orders: "Orders", add: "New", clients: "Clients", appointments: "Agenda", stats: "Stats", logout: "Log out" } });
    await findForm(tree)!.props.action!(); expect(logoutAction).toHaveBeenCalledTimes(1);
  });
});

import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrdersOverview } from "@/application/dtos/OrdersOverview";
import type { OrdersOverviewParams } from "@/app/orders/ordersOverviewParams";

const hooks = vi.hoisted(() => ({
  cursor: 0, slots: [] as unknown[], effects: [] as (() => void | (() => void))[],
  pending: false, dirty: false, push: vi.fn(), replace: vi.fn(), refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: hooks.push, replace: hooks.replace, refresh: hooks.refresh }), usePathname: () => "/orders", useSearchParams: () => new URLSearchParams() }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useState: (initial: unknown) => {
    const index = hooks.cursor++; if (!(index in hooks.slots)) hooks.slots[index] = initial;
    return [hooks.slots[index], (value: unknown) => { const next = typeof value === "function" ? value(hooks.slots[index]) : value; if (!Object.is(next, hooks.slots[index])) hooks.dirty = true; hooks.slots[index] = next; }];
  },
  useRef: (initial: unknown) => { const index = hooks.cursor++; return hooks.slots[index] ?? (hooks.slots[index] = { current: initial }); },
  useEffect: (effect: () => void | (() => void), dependencies: unknown[]) => {
    const index = hooks.cursor++; const previous = hooks.slots[index] as unknown[] | undefined;
    if (!previous || dependencies.some((dep, i) => !Object.is(previous[i], dep))) hooks.effects.push(effect);
    hooks.slots[index] = dependencies;
  },
  useTransition: () => [hooks.pending, (work: () => void) => work()],
  useMemo: (factory: () => unknown) => { const index = hooks.cursor++; return hooks.slots[index] ?? (hooks.slots[index] = factory()); },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
import { OrdersOverviewClient } from "@/app/orders/OrdersOverviewClient";
import { OrderSyncProvider } from "@/app/sync/OrderSyncProvider";
import { GetOrdersOverview } from "@/application/useCases/GetOrdersOverview";
import type { OrdersOverviewReader } from "@/application/ports/OrdersOverviewReader";

// Controlled hooks exercise actual handlers and dependency changes, not a browser lifecycle.
const overview: OrdersOverview = { asOf: "2026-07-01T12:00:00Z", counts: { status: "ready", data: { overdue: 1, dueToday: 1, dueTomorrow: 0, readyForPickup: 1, active: 4 } }, toCollect: { status: "ready", data: { status: "ready", amountCents: 100 } }, list: { status: "ready", data: { items: [], totalCount: 0, page: 1, pageSize: 8, hasNextPage: false } } };
type Element = React.ReactElement<Record<string, unknown>>;
function nodes(node: unknown): Element[] {
  if (!React.isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...React.Children.toArray(node.props.children as React.ReactNode).flatMap(nodes)];
}
let cleanups: (() => void)[];
let params: OrdersOverviewParams;
function render() {
  let tree; let attempts = 0;
  do {
    hooks.dirty = false; hooks.cursor = 0;
    tree = OrdersOverviewClient({ overview, params, locale: "en" });
    if (++attempts > 10) throw new Error("Render loop");
  } while (hooks.dirty);
  for (const effect of hooks.effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
  return nodes(tree);
}
function change(value: string) {
  const input = render().find(node => node.type === "input" && node.props.name === "q")!;
  (input.props.onChange as (event: unknown) => void)({ target: { value } });
}
function clickHref(href: string) {
  const link = render().find(node => node.props.href === href && node.props.onClick)!;
  (link.props.onClick as (event: unknown) => void)({ button: 0, preventDefault: vi.fn() });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); hooks.slots = []; hooks.effects = []; hooks.pending = false;
  cleanups = []; params = { selection: { kind: "active" }, q: "", page: 1 };
  vi.stubGlobal("window", Object.assign(new EventTarget(), { location: { search: "" } }));
});

class Channel {
  static instances: Channel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly name: string) { Channel.instances.push(this); }
  postMessage(data: unknown) { for (const other of Channel.instances) if (other !== this) other.onmessage?.({ data }); }
  close() { Channel.instances = Channel.instances.filter(channel => channel !== this); }
}
describe("R06 overview after R05 invalidation", () => {
  it("updates two sessions after a payment and status transition, with no new transport", async () => {
    Channel.instances = []; vi.stubGlobal("BroadcastChannel", Channel);
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { lang: "en" } }));
    function mount() {
      hooks.slots = []; hooks.cursor = 0;
      const tree = OrderSyncProvider({ children: null });
      for (const effect of hooks.effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
      const session = tree.props.value;
      session.markRead("initial"); session.setPending(false);
      return session;
    }
    const first = mount(); const second = mount();
    let paid = 0; let ready = true;
    const reader: OrdersOverviewReader = {
      readCounts: async () => ({ overdue: 0, dueToday: 0, dueTomorrow: 0, readyForPickup: ready ? 1 : 0, active: ready ? 1 : 0 }),
      readToCollect: async () => ({ status: "ready", amountCents: ready ? 1000 - paid : 0 }),
      readPage: async () => ({ items: [], totalCount: ready ? 1 : 0, page: 1, pageSize: 8, hasNextPage: false }),
    };
    const useCase = new GetOrdersOverview(reader);
    const query = { selection: { kind: "active" as const }, search: "", page: 1, now: new Date(overview.asOf) };
    let firstView = await useCase.execute(query); let secondView = await useCase.execute(query);
    expect(firstView.toCollect).toEqual(secondView.toCollect);
    const target = { kind: "order" as const, orderId: "00000000-0000-4000-8000-000000000001", clientId: "00000000-0000-4000-8000-000000000002", orderNumber: "260907-0001" };
    paid = 200;
    first.consume({ eventId: "00000000-0000-4000-8000-000000000003", target, snapshot: null });
    expect(second.phase()).toBe("refreshing");
    [firstView, secondView] = await Promise.all([useCase.execute(query), useCase.execute(query)]);
    first.markRead("payment"); second.markRead("payment"); first.setPending(false); second.setPending(false);
    expect(firstView.toCollect).toEqual({ status: "ready", data: { status: "ready", amountCents: 800 } });
    expect(secondView.toCollect).toEqual(firstView.toCollect);
    expect(secondView.counts).toMatchObject({ data: { readyForPickup: 1 } });
    ready = false;
    first.consume({ eventId: "00000000-0000-4000-8000-000000000004", target, snapshot: null });
    secondView = await useCase.execute(query); second.markRead("collected"); second.setPending(false);
    expect(secondView.counts).toMatchObject({ data: { active: 0, readyForPickup: 0 } });
    expect(secondView.toCollect).toMatchObject({ data: { amountCents: 0 } });
    expect(Channel.instances.every(channel => channel.name === "mendesk-order-invalidation-v1")).toBe(true);
  });
});
afterEach(() => { cleanups.forEach(cleanup => cleanup()); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("R06 navigation interactions", () => {
  it("marks old results inert immediately, before the debounce expires", () => {
    change("Ada");
    expect(render().find(node => node.type === "section" && "inert" in node.props)?.props.inert).toBe(true);
    expect(hooks.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(179); expect(hooks.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1); expect(hooks.replace).toHaveBeenCalledWith("/orders?q=Ada", { scroll: false });
  });
  it("cancels superseded searches and submits Enter without a second request", () => {
    change("A"); vi.advanceTimersByTime(100); change("Ada");
    const form = render().find(node => node.type === "form")!;
    (form.props.onSubmit as (event: unknown) => void)({ preventDefault: vi.fn() });
    vi.runAllTimers(); expect(hooks.replace).toHaveBeenCalledExactlyOnceWith("/orders?q=Ada", { scroll: false });
  });
  it("keeps the latest search when a slower intermediate response arrives", () => {
    change("A"); vi.advanceTimersByTime(180);
    change("Ada"); vi.advanceTimersByTime(180);
    params = { ...params, q: "A" };
    expect(render().find(node => node.props.name === "q")?.props.value).toBe("Ada");
    expect(render().find(node => "inert" in node.props)?.props.inert).toBe(true);
    params = { ...params, q: "Ada" };
    expect(render().find(node => "inert" in node.props)?.props.inert).toBe(false);
  });
  it("selects a filter once and cancels the old search timer", () => {
    change("Ada");
    clickHref("/orders?view=ready&q=Ada"); vi.runAllTimers();
    expect(hooks.push).toHaveBeenCalledExactlyOnceWith("/orders?view=ready&q=Ada", { scroll: false });
    expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("restores browser Back and cancels abandoned typing", () => {
    change("Abandoned");
    window.location.search = "?view=collected&q=Previous&page=2";
    window.dispatchEvent(new Event("popstate"));
    params = { selection: { kind: "status", value: "collected" }, q: "Previous", page: 2 };
    expect(render().find(node => node.props.name === "q")?.props.value).toBe("Previous");
    vi.runAllTimers(); expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("treats duplicate Back parameters exactly like the server parser", () => {
    render();
    window.location.search = "?q=A&q=B&view=ready&view=collected";
    window.dispatchEvent(new Event("popstate"));
    params = { selection: { kind: "active" }, q: "", page: 1 };
    expect(render().find(node => node.props.name === "q")?.props.value).toBe("");
    expect(render().find(node => "inert" in node.props)?.props.inert).toBe(false);
  });
  it("Show all preserves search but resets page and anchor", () => {
    params = { selection: { kind: "attention", value: "overdue" }, q: "Ada", page: 3, anchor: "order-test" };
    clickHref("/orders?q=Ada");
    expect(hooks.push).toHaveBeenCalledWith("/orders?q=Ada", { scroll: false });
  });
  it("does not reset an empty page implicitly or loop on a missing anchor", () => {
    params = { selection: { kind: "status", value: "ready" }, q: "", page: 3, anchor: "order-missing" };
    render(); render(); expect(hooks.push).not.toHaveBeenCalled(); expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("cancels timers when unmounted", () => {
    change("Ada"); cleanups.forEach(cleanup => cleanup()); cleanups = [];
    vi.runAllTimers(); expect(hooks.replace).not.toHaveBeenCalled();
  });
  it("blocks pagination rather than discarding a pending search", () => {
    params = { ...params, page: 2 };
    change("Ada");
    const pagination = render().find(node => node.type === "nav" && node.props["aria-label"] === "Order pages")!;
    expect(pagination.props.inert).toBe(true);
    expect(hooks.push).not.toHaveBeenCalled();
    vi.advanceTimersByTime(180);
    expect(hooks.replace).toHaveBeenCalledWith("/orders?q=Ada", { scroll: false });
  });
  it("announces the completed result and preserves keyboard focus on filter close", () => {
    const status = render().find(node => node.type === "p" && node.props.role === "status")!;
    expect(status.props.children).toBe("No active orders.");
    const details = render().find(node => node.type === "details")!;
    const summary = render().find(node => node.type === "summary")!;
    const focus = vi.fn();
    (details.props.ref as { current: unknown }).current = { open: true };
    (summary.props.ref as { current: unknown }).current = { focus };
    const link = render().find(node => node.props.href === "/orders?view=ready" && node.props.onClick)!;
    (link.props.onClick as (event: unknown) => void)({ button: 0, preventDefault: vi.fn(), currentTarget: { closest: () => ({ open: true, querySelector: () => ({ focus }) }) } });
    expect(focus).toHaveBeenCalledOnce();
  });
});

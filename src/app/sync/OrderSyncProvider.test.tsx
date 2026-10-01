import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), effects: [] as (() => void | (() => void))[], pathname: "/orders" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
  usePathname: () => mocks.pathname, useSearchParams: () => new URLSearchParams(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useTransition: () => [false, (work: () => void) => work()],
}));
import { OrderSyncProvider } from "./OrderSyncProvider";
const target = { kind: "order" as const, orderId: "00000000-0000-4000-8000-000000000001", clientId: "00000000-0000-4000-8000-000000000002", orderNumber: "260907-0142" };
const receipt = { eventId: "00000000-0000-4000-8000-000000000003", target, snapshot: null };

class FakeChannel {
  static channels: FakeChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  postMessage = vi.fn((data: unknown) => {
    for (const channel of FakeChannel.channels) if (channel !== this && !channel.closed) channel.onmessage?.({ data });
  });
  constructor(readonly name: string) { FakeChannel.channels.push(this); }
  close() { this.closed = true; }
}

describe("OrderSyncProvider lifecycle and transport", () => {
  let cleanups: (() => void)[];
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); mocks.effects = []; mocks.pathname = "/orders";
    cleanups = []; FakeChannel.channels = [];
    vi.stubGlobal("BroadcastChannel", FakeChannel);
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { lang: "en" } }));
  });
  afterEach(() => { cleanups.forEach((cleanup) => cleanup()); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function mount() {
    const tree = OrderSyncProvider({ children: null, locale: "en" });
    for (const effect of mocks.effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    const session = tree.props.value;
    session.markRead("initial");
    session.setPending(false);
    return session;
  }
  it("sends identifiers only and refreshes a second tab without echo", () => {
    const first = mount(); const second = mount();
    first.consume(receipt);
    expect(FakeChannel.channels[0]!.postMessage).toHaveBeenCalledWith({ version: 1, eventId: receipt.eventId, target });
    expect(FakeChannel.channels[1]!.postMessage).not.toHaveBeenCalled();
    first.consume(receipt);
    expect(FakeChannel.channels[0]!.postMessage).toHaveBeenCalledTimes(1);
    expect(second.phase()).toBe("refreshing");
  });
  it("waits for a fresh read marker and transition completion", () => {
    const session = mount();
    session.consume(receipt);
    session.setPending(true);
    session.markRead("new");
    expect(session.phase()).toBe("refreshing");
    session.setPending(false);
    expect(session.phase()).toBe("ready");
  });
  it("coalesces focus and visibility and never polls", () => {
    const session = mount();
    const before = mocks.refresh.mock.calls.length;
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(99);
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    vi.advanceTimersByTime(1);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
    session.markRead("fresh"); session.setPending(false);
    vi.advanceTimersByTime(60_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("defers hidden tabs and rereads when visible even without a signal", () => {
    const session = mount();
    Object.assign(document, { visibilityState: "hidden" });
    const before = mocks.refresh.mock.calls.length;
    session.receive({ version: 1, eventId: receipt.eventId, target });
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    Object.assign(document, { visibilityState: "visible" });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(100);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("preserves a dirty signal arriving during a read", () => {
    const session = mount();
    session.consume(receipt);
    const before = mocks.refresh.mock.calls.length;
    session.receive({ version: 1, eventId: "00000000-0000-4000-8000-000000000004", target });
    session.markRead("fresh"); session.setPending(false);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("rejects excessive payloads and cleans up the transport", () => {
    const session = mount(); const before = mocks.refresh.mock.calls.length;
    session.receive({ version: 1, eventId: receipt.eventId, target, phone: "private" });
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    cleanups.forEach((cleanup) => cleanup()); cleanups = [];
    expect(FakeChannel.channels.every((channel) => channel.closed)).toBe(true);
  });
  it("times out as a read error without repeating a write", () => {
    const session = mount(); session.consume(receipt);
    vi.advanceTimersByTime(15_000);
    expect(session.phase()).toBe("error");
    const before = mocks.refresh.mock.calls.length;
    session.retry();
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("keeps local reads working without BroadcastChannel", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const session = mount(); session.consume(receipt);
    expect(session.phase()).toBe("refreshing");
  });
  it("publishes a child receipt consumed before the parent mount effect", () => {
    const tree = OrderSyncProvider({ children: null, locale: "en" });
    tree.props.value.consume(receipt);
    for (const effect of mocks.effects.splice(0)) { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); }
    expect(FakeChannel.channels[0]!.postMessage).toHaveBeenCalledTimes(1);
  });
  it("bounds duplicate memory to 256 signals", () => {
    const session = mount();
    for (let index = 0; index < 257; index++) {
      session.receive({ version: 1, eventId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`, target });
    }
    expect(session.hasSeen("00000000-0000-4000-8000-000000000000")).toBe(false);
    expect(session.hasSeen("00000000-0000-4000-8000-000000000100")).toBe(true);
  });
  it("does not treat a repeated marker as a fresh read", () => {
    const session = mount(); session.consume(receipt);
    session.markRead("initial"); session.setPending(false);
    expect(session.phase()).toBe("refreshing");
  });
  it("rereads navigation, but not creation or public routes", () => {
    const session = mount();
    const before = mocks.refresh.mock.calls.length;
    session.navigate("/stats");
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
    for (const path of ["/login", "/kiosk", "/offline", "/orders/new", "/settings"]) session.navigate(path);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("keeps deduplication across effect cleanup and restart", () => {
    const session = mount(); session.consume(receipt);
    cleanups.forEach((cleanup) => cleanup()); cleanups = [];
    cleanups.push(session.start());
    session.consume(receipt);
    expect(FakeChannel.channels[0]!.postMessage).toHaveBeenCalledTimes(1);
    expect(FakeChannel.channels[1]!.postMessage).not.toHaveBeenCalled();
  });
  it("keeps read recovery when channel construction throws", () => {
    vi.stubGlobal("BroadcastChannel", class { constructor() { throw new Error("unavailable"); } });
    const session = mount(); session.consume(receipt);
    expect(session.phase()).toBe("refreshing");
  });
  it("blocks a local receipt until a hidden page can read it", () => {
    const session = mount();
    Object.assign(document, { visibilityState: "hidden" });
    session.consume(receipt);
    expect(session.phase()).toBe("refreshing");
  });
  it("retries a completed partial read with one click before timeout", () => {
    const session = mount();
    session.navigate("/orders");
    session.setPending(true);
    session.setPending(false);
    expect(session.phase()).toBe("error");
    const before = mocks.refresh.mock.calls.length;
    session.retry();
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
    expect(session.phase()).toBe("refreshing");
    session.markRead("recovered");
    expect(session.phase()).toBe("ready");
  });
  it("drains a retry queued during a partial transition without parallel reads", () => {
    const session = mount(); session.navigate("/orders");
    const before = mocks.refresh.mock.calls.length;
    session.setPending(false);
    session.retry();
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    session.setPending(true);
    session.retry();
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    session.setPending(false);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
    session.setPending(true); session.setPending(false);
    expect(session.phase()).toBe("error");
    vi.advanceTimersByTime(60_000);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
  });
  it("runs a retry queued after timeout when the pending transition ends", () => {
    const session = mount(); session.consume(receipt);
    session.setPending(true);
    vi.advanceTimersByTime(15_000);
    expect(session.phase()).toBe("error");
    const before = mocks.refresh.mock.calls.length;
    session.retry();
    expect(mocks.refresh).toHaveBeenCalledTimes(before);
    session.setPending(false);
    expect(mocks.refresh).toHaveBeenCalledTimes(before + 1);
    session.markRead("retry-result"); session.setPending(false);
    expect(session.phase()).toBe("ready");
  });
});

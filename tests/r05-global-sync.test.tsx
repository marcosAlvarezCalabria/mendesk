import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderNumber } from "@/domain/values/OrderNumber";
import { OrderStatus } from "@/domain/values/OrderStatus";
import { Money } from "@/domain/values/Money";
const mocks = vi.hoisted(() => ({
  execute: vi.fn(), read: vi.fn(), invalidate: vi.fn(), refreshTab: vi.fn(),
  tab: "one", path: "/orders", query: "", effectIndex: 0,
  memos: new Map<string, unknown>(),
  routes: new Map<string, string>(),
  dependencies: new Map<string, readonly unknown[]>(),
  effects: [] as (() => void | (() => void))[],
  routers: new Map<string, { refresh: () => void }>(),
  startTransition: (work: () => void) => work(),
}));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useMemo: (factory: () => unknown) => {
    if (!mocks.memos.has(mocks.tab)) mocks.memos.set(mocks.tab, factory());
    return mocks.memos.get(mocks.tab);
  },
  useEffect: (effect: () => void | (() => void), dependencies: readonly unknown[]) => {
    const key = mocks.tab + ":" + mocks.effectIndex++;
    const previous = mocks.dependencies.get(key);
    if (!previous || dependencies.some((value, index) => value !== previous[index])) mocks.effects.push(effect);
    mocks.dependencies.set(key, dependencies);
  },
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
  useTransition: () => [false, mocks.startTransition],
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("next/navigation", () => ({
  redirect: () => { throw new Error("redirect"); }, notFound: () => { throw new Error("not found"); },
  usePathname: () => mocks.path, useSearchParams: () => new URLSearchParams(mocks.query),
  useRouter: () => {
    const tab = mocks.tab;
    if (!mocks.routers.has(tab)) mocks.routers.set(tab, { refresh: () => mocks.refreshTab(tab) });
    return mocks.routers.get(tab);
  },
}));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "test-only" }));
vi.mock("@/i18n/getLocale", () => ({ getLocale: async () => "en" }));
vi.mock("@/composition/directus", () => ({
  makeOrderRepository: () => ({ getByOrderNumber: mocks.read }),
  makePaymentRepository: () => ({}), makeGarmentRepository: () => ({}),
  makeClientRepository: () => ({}), makePhotoStorage: () => ({}),
}));
vi.mock("@/application/useCases/RecordPayment", () => ({ RecordPayment: class { execute = mocks.execute; } }));
vi.mock("@/application/useCases/EditOrderDetails", () => ({ EditOrderDetails: class { execute = mocks.execute; } }));
vi.mock("@/application/useCases/EditGarment", () => ({ EditGarment: class { execute = mocks.execute; } }));
vi.mock("@/application/useCases/AddGarmentToOrder", () => ({ AddGarmentToOrder: class { execute = mocks.execute; } }));
vi.mock("@/application/useCases/RemoveGarmentFromOrder", () => ({ RemoveGarmentFromOrder: class { execute = mocks.execute; } }));
vi.mock("@/application/useCases/AnonymizeClient", () => ({ AnonymizeClient: class { execute = mocks.execute; } }));
import { recordPaymentAction } from "@/app/orders/[orderNumber]/payment-actions";
import { editOrderDetailsAction, editGarmentAction, addGarmentToOrderAction } from "@/app/orders/[orderNumber]/edit-actions";
import { removeGarmentAction } from "@/app/orders/[orderNumber]/remove-actions";
import { anonymizeClientAction } from "@/app/clients/[id]/actions";
import { OrderSyncProvider } from "@/app/sync/OrderSyncProvider";

const orderId = "00000000-0000-4000-8000-000000000001";
const clientId = "00000000-0000-4000-8000-000000000002";
const orderNumber = "260907-0142";
const date = new Date("2026-09-07T10:00:00Z");
const order = { id: orderId, orderNumber: OrderNumber.fromString(orderNumber),
  client: { id: clientId, name: "Example", phone: null, gdprConsent: true },
  status: OrderStatus.RECEIVED, receivedDate: date, dateUpdated: date, dueDate: date,
  garments: [{ id: "garment-1", description: "Hem", alterationType: "hem" as const, price: Money.fromEuros(20), dateUpdated: date }], payments: [] };

function form() {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    order_id: orderId, order_number: orderNumber, orderNumber, client_id: clientId,
    idempotency_key: "00000000-0000-4000-8000-000000000003",
    expected_date_updated: date.toISOString(), due_date: "2026-09-08",
    description: "Hem", alteration_type: "hem", price: "20", amount: "10",
    payment_type: "deposit", payment_method: "cash", garment_id: "garment-id",
  })) data.set(key, value);
  return data;
}

describe("R05 action synchronization integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.read.mockResolvedValue(order);
    mocks.execute.mockResolvedValue(order);
  });
  it.each([
    ["payment", recordPaymentAction], ["order edit", editOrderDetailsAction],
    ["garment edit", editGarmentAction], ["garment add", addGarmentToOrderAction],
    ["garment removal", removeGarmentAction],
  ] as const)("returns a persisted receipt for %s", async (_name, action) => {
    const result = await action({ status: "idle", error: null }, form());
    expect(result).toMatchObject({ mutationResult: "confirmed-saved", sync: {
      target: { kind: "order", orderId, orderNumber, clientId }, snapshot: { id: orderId },
    } });
    expect(mocks.execute).toHaveBeenCalledTimes(1);
    expect(mocks.invalidate).toHaveBeenCalledWith("/stats");
    expect(mocks.invalidate).toHaveBeenCalledWith(`/orders/${orderNumber}/tickets`);
  });
  it("propagates anonymization across client, order, ticket and appointment reads", async () => {
    const data = form();
    data.set("understood", "true");
    const result = await anonymizeClientAction({ status: "idle", error: null }, data);
    expect(result).toMatchObject({ sync: { target: { kind: "client", clientId }, snapshot: null } });
    expect(mocks.invalidate).toHaveBeenCalledWith("/appointments");
    expect(mocks.invalidate).toHaveBeenCalledWith("/orders/[orderNumber]/tickets", "page");
  });
  it("keeps a payment confirmed when its post-write read fails", async () => {
    mocks.read.mockResolvedValueOnce(order).mockRejectedValueOnce(new Error("read unavailable"));
    const result = await recordPaymentAction({ status: "idle", error: null }, form());
    expect(result).toMatchObject({ mutationResult: "confirmed-saved", sync: { snapshot: null, target: { orderId } } });
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("/stats");
  });
  it("rejects a forged payment order identity before writing or signaling", async () => {
    const data = form(); data.set("order_id", "different-order");
    const result = await recordPaymentAction({ status: "idle", error: null }, data);
    expect(result).toMatchObject({ mutationResult: "confirmed-not-saved" });
    expect(result).not.toHaveProperty("sync");
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
  it("does not signal an unknown payment outcome as saved", async () => {
    mocks.execute.mockRejectedValueOnce(new Error("response lost"));
    const result = await recordPaymentAction({ status: "idle", error: null }, form());
    expect(result).toMatchObject({ mutationResult: "outcome-unknown" });
    expect(result).not.toHaveProperty("sync");
    expect(mocks.invalidate).not.toHaveBeenCalled();
  });
});

class SurfaceChannel {
  static channels: SurfaceChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  closed = false;
  constructor() { SurfaceChannel.channels.push(this); }
  postMessage(data: unknown) {
    for (const channel of SurfaceChannel.channels) {
      if (channel !== this && !channel.closed) channel.onmessage?.({ data });
    }
  }
  close() { this.closed = true; }
}

describe("R05 distinct-surface synchronization", () => {
  type Session = ReturnType<typeof OrderSyncProvider>["props"]["value"];
  let sessions: Map<string, Session>;
  let displayed: Map<string, { status: string; paid: number; name: string }>;
  let source: { status: string; paid: number; name: string };
  let reads: (() => void)[];
  let cleanups: (() => void)[];
  let readSequence: number;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks();
    mocks.memos.clear(); mocks.dependencies.clear(); mocks.routers.clear(); mocks.routes.clear();
    mocks.effects = []; SurfaceChannel.channels = [];
    sessions = new Map(); displayed = new Map(); reads = []; cleanups = []; readSequence = 0;
    source = { status: "received", paid: 0, name: "Example" };
    vi.stubGlobal("BroadcastChannel", SurfaceChannel);
    vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { lang: "en" } }));
    mocks.refreshTab.mockImplementation((tab: string) => {
      const result = { ...source };
      reads.push(() => {
        displayed.set(tab, result);
        sessions.get(tab).markRead("read-" + ++readSequence);
        sessions.get(tab).setPending(false);
      });
    });
  });
  afterEach(() => {
    cleanups.forEach((cleanup) => cleanup());
    vi.unstubAllGlobals(); vi.useRealTimers();
  });
  function renderTab(tab: string, path: string, query = "", cachedReadId?: string) {
    mocks.tab = tab; mocks.path = path; mocks.query = query; mocks.effectIndex = 0;
    mocks.routes.set(tab, path + (query ? "?" + query : ""));
    const tree = OrderSyncProvider({ children: null });
    const session = tree.props.value;
    sessions.set(tab, session);
    // React mounts child effects before the parent navigation effect.
    if (cachedReadId) session.markRead(cachedReadId);
    for (const effect of mocks.effects.splice(0)) {
      const cleanup = effect(); if (cleanup) cleanups.push(cleanup);
    }
    return session;
  }
  function flushReads() {
    while (reads.length) reads.shift()!();
  }
  it.each([
    ["/orders/260907-0142", "/orders"],
    ["/clients/00000000-0000-4000-8000-000000000002", "/orders/260907-0142/tickets"],
    ["/stats", "/appointments"],
  ])("replaces stale reads in %s and %s after a signal", (leftPath, rightPath) => {
    const left = renderTab("left", leftPath, "", "left-cached");
    renderTab("right", rightPath, "", "right-cached");
    flushReads();
    expect(displayed.get("left")).toEqual(source);
    expect(displayed.get("right")).toEqual(source);

    source = { status: "ready", paid: 1200, name: "Deleted client" };
    left.consume({ eventId: "00000000-0000-4000-8000-000000000003", target: { kind: "client", clientId }, snapshot: null });
    expect(displayed.get("left")?.status).toBe("received");
    expect(displayed.get("right")?.paid).toBe(0);
    flushReads();

    expect(displayed.get("left")).toEqual(source);
    expect(displayed.get("right")).toEqual(source);
    expect(left.phase()).toBe("ready");
    expect(sessions.get("right").phase()).toBe("ready");
  });
  it("rereads changed query parameters and a prefetched return route", () => {
    const session = renderTab("one", "/orders", "status=received", "cached-orders");
    flushReads();
    const before = mocks.refreshTab.mock.calls.length;
    renderTab("one", "/orders", "status=ready");
    expect(mocks.refreshTab).toHaveBeenCalledTimes(before + 1);
    flushReads();
    renderTab("one", "/stats", "", "cached-stats"); flushReads();

    source = { status: "ready", paid: 1200, name: "Example" };
    renderTab("one", "/orders", "status=ready", "cached-orders");
    session.setPending(false);
    expect(session.phase()).toBe("refreshing");
    expect(displayed.get("one")?.paid).toBe(0);
    expect(mocks.routes.get("one")).toBe("/orders?status=ready");
    flushReads();
    expect(session.phase()).toBe("ready");
    expect(displayed.get("one")).toEqual(source);
  });
});

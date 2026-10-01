import type { ContextType } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>, refresh: vi.fn(), invalidate: vi.fn(),
  getByPhone: vi.fn(), create: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }), usePathname: () => "/clients", useSearchParams: () => new URLSearchParams() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.invalidate }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: async () => "test-session", clearSessionCookie: vi.fn() }));
vi.mock("@/composition/directus", () => ({ makeClientRepository: () => ({ getByPhone: mocks.getByPhone, create: mocks.create }) }));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useMemo: (factory: () => unknown) => factory(),
  useEffect: (effect: () => void | (() => void)) => { mocks.effects.push(effect); },
  useTransition: () => [false, (work: () => void) => work()],
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot(),
}));
import { OrderSyncProvider, type OrderSyncContext } from "@/app/sync/OrderSyncProvider";
import { completeClientMutation } from "@/app/sync/server";
import { createClientsSearchSession } from "../clientsSearchSession";
import { registerClientAction } from "./actions";
import { PhoneNumber } from "@/domain/values/PhoneNumber";
const clientId = "00000000-0000-4000-8000-000000000007";
const client = { id: clientId, name: "Example", phone: PhoneNumber.fromRaw("0850000001"), gdprConsent: true };
const row = { ...client, phone: client.phone.value };
class FakeChannel {
  static channels: FakeChannel[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  postMessage = vi.fn((data: unknown) => {
    for (const other of FakeChannel.channels) if (other !== this) other.onmessage?.({ data });
  });
  constructor() { FakeChannel.channels.push(this); }
  close() { this.onmessage = null; }
}
describe("client registration and existing synchronization integration", () => {
  let persisted: typeof row[];
  let cleanup: Array<() => void>;
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllMocks(); mocks.effects = []; FakeChannel.channels = [];
    persisted = []; cleanup = [];
    vi.stubGlobal("BroadcastChannel", FakeChannel); vi.stubGlobal("window", new EventTarget());
    vi.stubGlobal("document", Object.assign(new EventTarget(), { visibilityState: "visible", documentElement: { lang: "en" } }));
    mocks.getByPhone.mockImplementation(async () => persisted.length ? client : null);
    mocks.create.mockImplementation(async () => { persisted = [row]; return client; });
  });
  afterEach(() => { cleanup.forEach(fn => fn()); vi.unstubAllGlobals(); vi.useRealTimers(); });
  function mountDirectory() {
    const directory = createClientsSearchSession({ query: "", page: 1, result: { items: [], hasNextPage: false } }, { fetchPage: vi.fn(), authenticate: vi.fn(), replace: vi.fn() });
    const refresh = vi.fn(() => {
      directory.adopt({ query: "", page: 1, result: { items: [...persisted], hasNextPage: false } });
      sync.markRead(crypto.randomUUID());
    });
    mocks.refresh = refresh;
    const sync: NonNullable<ContextType<typeof OrderSyncContext>> = OrderSyncProvider({ children: null, locale: "en" }).props.value;
    for (const effect of mocks.effects.splice(0)) { const dispose = effect(); if (dispose) cleanup.push(dispose); }
    return { sync, directory, refresh };
  }
  function form() {
    const data = new FormData();
    data.set("mode", "create"); data.set("name", client.name); data.set("phone", "0850000001"); data.set("gdprConsent", "true");
    return data;
  }
  it("creates once, invalidates routes and replaces empty directories in both tabs without echo", async () => {
    const first = mountDirectory(); const second = mountDirectory();
    expect(first.directory.snapshot().result.items).toEqual([]);
    const result = await registerClientAction({ status: "idle" }, form());
    expect(result.status).toBe("success"); expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.invalidate).toHaveBeenCalledWith("/clients");
    first.sync.consume(result.sync!);
    expect(first.directory.snapshot().result.items).toEqual([row]);
    expect(second.directory.snapshot().result.items).toEqual([row]);
    expect(second.sync.phase()).toBe("ready");
    expect(FakeChannel.channels[0]!.postMessage).toHaveBeenCalledWith({ version: 1, eventId: result.sync!.eventId, target: { kind: "client", clientId } });
    expect(FakeChannel.channels[1]!.postMessage).not.toHaveBeenCalled();
    const reads = second.refresh.mock.calls.length;
    first.sync.consume(result.sync!); expect(second.refresh).toHaveBeenCalledTimes(reads);
    const duplicate = await registerClientAction({ status: "idle" }, form());
    expect(duplicate.status).toBe("existing"); expect(duplicate.sync).toBeUndefined(); expect(mocks.create).toHaveBeenCalledOnce();
  });
  it("rereads on focus without creating and removes a record after a confirmed client invalidation", async () => {
    const first = mountDirectory(); const second = mountDirectory();
    persisted = [row]; window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(100);
    expect(first.directory.snapshot().result.items).toEqual([row]); expect(second.directory.snapshot().result.items).toEqual([row]);
    expect(mocks.create).not.toHaveBeenCalled();
    persisted = []; first.sync.consume(await completeClientMutation(clientId));
    expect(first.directory.snapshot().result.items).toEqual([]); expect(second.directory.snapshot().result.items).toEqual([]);
    const reads = second.refresh.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(second.refresh).toHaveBeenCalledTimes(reads); expect(mocks.create).not.toHaveBeenCalled();
  });
});

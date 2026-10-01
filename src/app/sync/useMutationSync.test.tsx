import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consume: vi.fn(), retry: vi.fn(), seen: false, phase: "refreshing",
  effects: [] as (() => void)[],
}));
vi.mock("react", () => ({
  useContext: () => ({ consume: mocks.consume, retry: mocks.retry, subscribe: () => () => {}, snapshot: () => 0, hasSeen: () => mocks.seen, phase: () => mocks.phase }),
  useEffect: (effect: () => void) => { mocks.effects.push(effect); },
  useSyncExternalStore: () => 0,
}));
vi.mock("./OrderSyncProvider", () => ({ OrderSyncContext: {} }));
import { useMutationSync } from "./useMutationSync";

const receipt = { eventId: "00000000-0000-4000-8000-000000000001", target: { kind: "client" as const, clientId: "00000000-0000-4000-8000-000000000002" }, snapshot: null };

describe("useMutationSync", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.effects = []; mocks.seen = false; mocks.phase = "refreshing"; });
  it("is idle without a receipt", () => {
    expect(useMutationSync(undefined).phase).toBe("idle");
    mocks.effects.forEach((effect) => effect());
    expect(mocks.consume).not.toHaveBeenCalled();
  });
  it("consumes the confirmed receipt and waits for the coordinator", () => {
    expect(useMutationSync(receipt).phase).toBe("refreshing");
    mocks.effects.forEach((effect) => effect());
    expect(mocks.consume).toHaveBeenCalledWith(receipt);
    mocks.seen = true; mocks.phase = "ready";
    expect(useMutationSync(receipt).phase).toBe("ready");
  });
  it("retries a read without consuming or publishing another receipt", () => {
    mocks.seen = true; mocks.phase = "error";
    const sync = useMutationSync(receipt);
    expect(sync.phase).toBe("error");
    sync.retry();
    expect(mocks.retry).toHaveBeenCalledOnce();
    expect(mocks.consume).not.toHaveBeenCalled();
  });
});

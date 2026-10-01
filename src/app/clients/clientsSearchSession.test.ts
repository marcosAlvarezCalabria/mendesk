import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClientsSearchSession } from "./clientsSearchSession";
const initial = { items: [{ id: "client-1", name: "Example", phone: "353850000001", gdprConsent: true }], hasNextPage: true };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function response(name: string) { return { ok: true, status: 200, json: async () => ({ ...initial, items: [{ ...initial.items[0], name }] }) } as Response; }
function setup() {
  const fetchPage = vi.fn(), authenticate = vi.fn(), replace = vi.fn();
  const session = createClientsSearchSession({ query: "", page: 1, result: initial }, { fetchPage, authenticate, replace });
  return { session, fetchPage, authenticate, replace };
}
describe("client directory request ownership", () => {
  it("certifies a successful latest API read with a fresh marker, never an error", async () => {
    const { session, fetchPage } = setup(); fetchPage.mockResolvedValueOnce(response("Current")).mockResolvedValueOnce({ ok: false, status: 500 });
    session.search("Current"); await vi.advanceTimersByTimeAsync(250);
    expect(session.snapshot().readId).toEqual(expect.any(String));
    session.search("Failed"); await vi.advanceTimersByTimeAsync(250);
    expect(session.snapshot().readId).toBeUndefined();
  });
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());
  it("blocks old rows immediately and debounces at 250ms", async () => {
    const { session, fetchPage } = setup(); fetchPage.mockResolvedValue(response("New"));
    session.search("New"); expect(session.snapshot().status).toBe("loading");
    await vi.advanceTimersByTimeAsync(249); expect(fetchPage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1); expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(session.snapshot().status).toBe("ready");
    await vi.advanceTimersByTimeAsync(1); expect(fetchPage).toHaveBeenCalledTimes(1);
  });
  it("ignores an aborted older response even when fetch ignores abort", async () => {
    const { session, fetchPage } = setup(); const old = deferred<Response>();
    fetchPage.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response("Latest"));
    session.search("Old"); await vi.advanceTimersByTimeAsync(250);
    session.search("Latest"); await vi.advanceTimersByTimeAsync(250);
    old.resolve(response("Old")); await vi.advanceTimersByTimeAsync(0);
    expect(session.snapshot().result.items[0]?.name).toBe("Latest");
  });
  it.each([403, 500])("keeps old results blocked after %s and retries only the current query", async status => {
    const { session, fetchPage, authenticate } = setup();
    fetchPage.mockResolvedValueOnce({ ok: false, status }).mockResolvedValueOnce(response("Recovered"));
    session.search("Current"); await vi.advanceTimersByTimeAsync(250);
    expect(session.snapshot().status).toBe("error"); expect(authenticate).not.toHaveBeenCalled();
    session.retry(); await vi.advanceTimersByTimeAsync(0);
    expect(session.snapshot().result.items[0]?.name).toBe("Recovered");
    expect(fetchPage.mock.calls[1]?.[0]).toContain("search=Current");
  });
  it("rejects invalid JSON shapes rather than enabling stale rows", async () => {
    const { session, fetchPage } = setup(); fetchPage.mockResolvedValue({ ok: true, json: async () => ({ items: [{ id: "bad" }], hasNextPage: false }) });
    session.search("bad"); await vi.advanceTimersByTimeAsync(250); expect(session.snapshot().status).toBe("error");
  });
  it("uses login only on confirmed 401", async () => {
    const { session, fetchPage, authenticate } = setup(); fetchPage.mockResolvedValue({ ok: false, status: 401 });
    session.search("Example"); await vi.advanceTimersByTimeAsync(250);
    expect(authenticate).toHaveBeenCalledWith("/clients?q=Example"); expect(session.snapshot().status).toBe("error");
  });
  it("adopts new server data and cancels pending response ownership", async () => {
    const { session, fetchPage } = setup(); const old = deferred<Response>(); fetchPage.mockReturnValue(old.promise);
    session.search("Example"); await vi.advanceTimersByTimeAsync(250);
    session.adopt({ query: "Example", page: 1, result: { ...initial, items: [] } });
    old.resolve(response("Old")); await vi.advanceTimersByTimeAsync(0);
    expect(session.snapshot().result.items).toEqual([]); expect(session.snapshot().status).toBe("ready");
  });
  it("restores navigation without replacing browser history and discards anchors on new search", async () => {
    const { session, fetchPage, replace } = setup(); fetchPage.mockResolvedValue(response("Back"));
    session.navigate({ query: "Back", page: 2, anchor: "client-1" }); await vi.advanceTimersByTimeAsync(0);
    expect(replace).not.toHaveBeenCalled(); expect(session.snapshot().page).toBe(2);
    session.search("Next"); expect(session.snapshot().page).toBe(1); expect(session.snapshot().anchor).toBeUndefined();
  });
  it("coalesces retry while pending and disposes timers", () => {
    const { session, fetchPage } = setup(); session.search("pending"); session.retry(); session.dispose();
    vi.advanceTimersByTime(1000); expect(fetchPage).not.toHaveBeenCalled();
  });
});

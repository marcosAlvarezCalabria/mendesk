import { describe, expect, it, vi } from "vitest";
import { createClientRegistrationSession } from "./clientRegistrationSession";
const slot = "koko:client-registration:recovery:v1";
function setup(marker?: string) {
  const values = new Map(marker ? [[slot, marker]] : []);
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  const action = vi.fn(), login = vi.fn(), open = vi.fn();
  const session = createClientRegistrationSession("/clients?q=private&page=2", { storage: () => storage, action, login, open });
  session.hydrate(); return { session, values, storage, action, login, open };
}
describe("client registration UI recovery", () => {
  it("restores only a generic marker with empty fields and blocks create", async () => {
    const { session, action } = setup(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients?page=2" }));
    expect(session.snapshot()).toMatchObject({ name: "", phone: "", gdprConsent: false, recovery: true });
    await session.submit("create"); expect(action).not.toHaveBeenCalled();
  });
  it("checks only phone, allows create after absence, and checks again after a phone change", async () => {
    const { session, action } = setup(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients" }));
    session.change("phone", "0850000001"); action.mockResolvedValue({ status: "absent" }); await session.submit("reconcile");
    expect([...action.mock.calls[0]![1].keys()]).toEqual(["mode", "phone", "returnTo"]);
    expect(session.snapshot().checkedPhone).toBe("0850000001");
    session.change("phone", "0850000002"); expect(session.snapshot().checkedPhone).toBeNull();
    await session.submit("create"); expect(action).toHaveBeenCalledTimes(1);
  });
  it("prevents double submit synchronously and stores no PII", async () => {
    const { session, action, values } = setup(); let resolve!: (value: unknown) => void;
    action.mockReturnValue(new Promise(done => { resolve = done; }));
    session.change("name", "Example"); session.change("phone", "0850000001"); session.change("gdprConsent", true);
    const first = session.submit("create"); await session.submit("create");
    expect(action).toHaveBeenCalledTimes(1); expect(values.get(slot)).toBe(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients?page=2" }));
    resolve({ status: "error", mutationResult: "outcome-unknown" }); await first;
    await session.submit("create"); expect(action).toHaveBeenCalledTimes(1);
  });
  it("clears PII before login but retains generic marker", async () => {
    const { session, action, login, values } = setup(); session.change("name", "Example"); session.change("phone", "0850000001"); session.change("gdprConsent", true);
    action.mockResolvedValue({ status: "error", mutationResult: "auth-expired" }); await session.submit("create");
    expect(session.snapshot()).toMatchObject({ name: "", phone: "", gdprConsent: false });
    expect(login).toHaveBeenCalled(); expect(login.mock.calls[0]![0]).not.toContain("private"); expect(values.has(slot)).toBe(true);
  });
  it("opens a reconciled match without sending another create", async () => {
    const { session, action, open, values } = setup(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients" }));
    session.change("phone", "0850000001"); action.mockResolvedValue({ status: "existing", clientId: "test" }); await session.submit("reconcile");
    expect(open).toHaveBeenCalledWith("test", "/clients"); expect(values.size).toBe(0);
  });
  it("blocks writes if storage is unavailable", async () => {
    const action = vi.fn(); const session = createClientRegistrationSession("/clients", { storage: () => { throw new Error("denied"); }, action, login: vi.fn(), open: vi.fn() });
    session.change("name", "Example"); session.change("phone", "0850000001"); session.change("gdprConsent", true);
    session.hydrate(); await session.submit("create"); expect(action).not.toHaveBeenCalled(); expect(session.snapshot().storageError).toBe(true);
  });
  it("opens a confirmed result only once even when completion effects repeat", async () => {
    const { session, action, open } = setup();
    session.change("name", "Example"); session.change("phone", "0850000001"); session.change("gdprConsent", true);
    action.mockResolvedValue({ status: "success", clientId: "test", mutationResult: "confirmed-saved" });
    await session.submit("create"); session.open(); session.open();
    expect(open).toHaveBeenCalledOnce(); expect(action).toHaveBeenCalledOnce();
  });
  it("returns from auth to an empty form and reconciles the existing record without another create", async () => {
    const first = setup();
    first.session.change("name", "Example"); first.session.change("phone", "0850000001"); first.session.change("gdprConsent", true);
    first.action.mockResolvedValue({ status: "error", mutationResult: "auth-expired" });
    await first.session.submit("create");
    const returned = setup(first.values.get(slot));
    expect(returned.session.snapshot()).toMatchObject({ name: "", phone: "", gdprConsent: false, recovery: true });
    await returned.session.submit("create"); expect(returned.action).not.toHaveBeenCalled();
    returned.session.change("phone", "0850000001");
    returned.action.mockResolvedValue({ status: "existing", clientId: "test" });
    await returned.session.submit("reconcile");
    expect(returned.action).toHaveBeenCalledOnce();
    expect(returned.action.mock.calls[0]![1].get("mode")).toBe("reconcile");
    expect(returned.open).toHaveBeenCalledWith("test", "/clients?page=2"); expect(returned.values.size).toBe(0);
  });
  it("keeps creation blocked after failed reconciliation until absence and a deliberate valid submission", async () => {
    const { session, action } = setup(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients" }));
    session.change("phone", "0850000001");
    action.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ status: "absent" }).mockResolvedValueOnce({ status: "success", clientId: "test" });
    await session.submit("reconcile"); await session.submit("create");
    expect(action).toHaveBeenCalledOnce(); expect(session.snapshot()).toMatchObject({ recovery: true, pending: false, frozen: true });
    await session.submit("reconcile");
    expect(action).toHaveBeenCalledTimes(2); expect(session.snapshot()).toMatchObject({ frozen: false, checkedPhone: "0850000001" });
    session.change("name", "Example"); session.change("gdprConsent", true);
    await session.submit("create");
    expect(action.mock.calls.map(call => call[1].get("mode"))).toEqual(["reconcile", "reconcile", "create"]);
  });
  it("rejects an empty form locally without a request or recovery marker", async () => {
    const { session, action, values } = setup();
    action.mockResolvedValue({ status: "error", mutationResult: "confirmed-not-saved" });
    await session.submit("create");
    expect(action).not.toHaveBeenCalled(); expect(values.size).toBe(0);
    expect(session.snapshot()).toMatchObject({ pending: false, result: { status: "error", fieldErrors: { name: "required", phone: "invalid", gdprConsent: "required" } } });
  });
  it("rejects an invalid recovery phone without blocking the form", async () => {
    const { session, action } = setup(JSON.stringify({ status: "reconciliation-required", returnTo: "/clients" }));
    action.mockResolvedValue({ status: "error", mutationResult: "confirmed-not-saved" });
    await session.submit("reconcile");
    expect(action).not.toHaveBeenCalled();
    expect(session.snapshot()).toMatchObject({ pending: false, recovery: true, result: { fieldErrors: { phone: "invalid" } } });
  });
  it("rejects an unassigned country prefix locally before registration", async () => {
    const { session, action } = setup();
    session.change("name", "Example"); session.change("phone", "+999 123 456 789"); session.change("gdprConsent", true);
    await session.submit("create");
    expect(action).not.toHaveBeenCalled();
    expect(session.snapshot()).toMatchObject({ result: { status: "error", fieldErrors: { phone: "invalid" } } });
  });
  it.each(["success", "auth-expired"])("allows confirmed departure during a pending request and ignores late %s", async outcome => {
    const { session, action, login, open, values } = setup();
    let resolve!: (value: unknown) => void;
    action.mockReturnValue(new Promise(done => { resolve = done; }));
    session.change("name", "Example"); session.change("phone", "0850000001"); session.change("gdprConsent", true);
    const request = session.submit("create");
    expect(session.snapshot().pending).toBe(true);
    expect(session.abandon()).toBe(true);
    expect(session.snapshot()).toMatchObject({ pending: false, name: "", phone: "", gdprConsent: false });
    expect(values.size).toBe(0);
    resolve(outcome === "success" ? { status: "success", clientId: "test" } : { status: "error", mutationResult: "auth-expired" });
    await request; session.open(); await session.submit("create");
    expect(login).not.toHaveBeenCalled(); expect(open).not.toHaveBeenCalled(); expect(action).toHaveBeenCalledTimes(1);
    expect(session.snapshot().result.status).toBe("idle");
  });
});

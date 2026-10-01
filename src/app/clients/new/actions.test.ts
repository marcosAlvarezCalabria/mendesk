import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ token: vi.fn(), execute: vi.fn(), reconcile: vi.fn(), sync: vi.fn(), clear: vi.fn() }));
vi.mock("@/infrastructure/auth/sessionCookie", () => ({ getSessionToken: mocks.token, clearSessionCookie: mocks.clear }));
vi.mock("@/composition/directus", () => ({ makeClientRepository: vi.fn() }));
vi.mock("@/application/useCases/RegisterClient", () => ({ RegisterClient: class { execute = mocks.execute; reconcile = mocks.reconcile; } }));
vi.mock("@/app/sync/server", () => ({ completeClientMutation: mocks.sync }));
import { registerClientAction } from "./actions";
import { ClientRegistrationValidationError } from "@/domain/errors/ClientRegistrationValidationError";
const initial = { status: "idle" as const };
function data(mode = "create") { const form = new FormData(); form.set("mode", mode); form.set("name", "Example"); form.set("phone", "0850000001"); form.set("gdprConsent", "true"); return form; }
describe("registerClientAction", () => {
  it("clears the cookie only for confirmed expired authentication", async () => {
    mocks.reconcile.mockRejectedValue({ status: 401 });
    await registerClientAction(initial, data("reconcile")); expect(mocks.clear).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => { vi.resetAllMocks(); mocks.token.mockResolvedValue("test-session"); });
  it("requires authentication before reads or writes", async () => {
    mocks.token.mockResolvedValue(null);
    expect(await registerClientAction(initial, data())).toMatchObject({ mutationResult: "auth-expired" });
    expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.reconcile).not.toHaveBeenCalled();
  });
  it("returns identifiers and receipt after confirmed create", async () => {
    mocks.execute.mockResolvedValue({ type: "created", client: { id: "client-1" } }); mocks.sync.mockResolvedValue({ eventId: "event-1" });
    expect(await registerClientAction(initial, data())).toEqual({ status: "success", clientId: "client-1", mutationResult: "confirmed-saved", sync: { eventId: "event-1" } });
  });
  it("does not emit a mutation for a duplicate", async () => {
    mocks.execute.mockResolvedValue({ type: "existing", client: { id: "client-1" } });
    expect(await registerClientAction(initial, data())).toMatchObject({ status: "existing", clientId: "client-1" }); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("never loses confirmed save when invalidation fails", async () => {
    mocks.execute.mockResolvedValue({ type: "created", client: { id: "client-1" } }); mocks.sync.mockRejectedValue(new Error("cache unavailable"));
    expect(await registerClientAction(initial, data())).toEqual({ status: "success", clientId: "client-1", mutationResult: "confirmed-saved" });
  });
  it.each([null, { id: "client-1" }])("reconciles using only phone %j", async client => {
    mocks.reconcile.mockResolvedValue(client);
    expect(await registerClientAction(initial, data("reconcile"))).toEqual(client ? { status: "existing", clientId: "client-1" } : { status: "absent" });
    expect(mocks.reconcile).toHaveBeenCalledWith("0850000001"); expect(mocks.execute).not.toHaveBeenCalled(); expect(mocks.sync).not.toHaveBeenCalled();
  });
  it("maps field validation without technical details", async () => {
    mocks.execute.mockRejectedValue(new ClientRegistrationValidationError("name"));
    expect(await registerClientAction(initial, data())).toMatchObject({ mutationResult: "confirmed-not-saved", fieldErrors: { name: "required" } });
  });
  it.each([{ status: 401 }, new Error("network")])("distinguishes auth from network", async error => {
    mocks.reconcile.mockRejectedValue(error);
    expect(await registerClientAction(initial, data("reconcile"))).toMatchObject({ status: "error", mutationResult: "status" in error ? "auth-expired" : "outcome-unknown" });
  });
  it("rejects an unrecognized mode", async () => {
    expect(await registerClientAction(initial, data("overwrite"))).toMatchObject({ status: "error", mutationResult: "confirmed-not-saved" }); expect(mocks.execute).not.toHaveBeenCalled();
  });
});

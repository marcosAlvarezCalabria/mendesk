import { describe, expect, it, vi } from "vitest";
import { readClientRegistrationRecovery, writeClientRegistrationRecovery, clearClientRegistrationRecovery } from "./clientRegistrationRecovery";
const key = "mendesk:client-registration:recovery:v1";
describe("client registration recovery privacy", () => {
  it("stores only a generic marker and safe pagination without search", () => {
    const storage = { setItem: vi.fn() };
    expect(writeClientRegistrationRecovery(storage, "/clients?q=private-phone&page=2&anchor=client-123")).toBe(true);
    expect(storage.setItem).toHaveBeenCalledExactlyOnceWith(key, JSON.stringify({ status: "reconciliation-required", returnTo: "/clients?page=2&anchor=client-123" }));
  });
  it.each(["https://evil.invalid", "/clients?returnTo=/clients?q=secret", "/clients?page=2&page=3", "/orders"])("sanitizes %s", returnTo => {
    const storage = { setItem: vi.fn() }; writeClientRegistrationRecovery(storage, returnTo);
    expect(JSON.parse(storage.setItem.mock.calls[0]![1]).returnTo).toBe("/clients");
  });
  it("reads a canonical marker", () => {
    const value = { status: "reconciliation-required", returnTo: "/clients?page=2" };
    expect(readClientRegistrationRecovery({ getItem: () => JSON.stringify(value) })).toEqual(value);
  });
  it.each([null, "{", "null", "[]", JSON.stringify({ status: "reconciliation-required", returnTo: "/clients?q=private" }), JSON.stringify({ status: "reconciliation-required", returnTo: "/clients", phone: "private" }), JSON.stringify({ status: "absent", returnTo: "/clients" })])("rejects malformed or private payload %j", value => {
    expect(readClientRegistrationRecovery({ getItem: () => value })).toBeNull();
  });
  it("handles storage errors without claiming success", () => {
    const fail = () => { throw new Error("denied"); };
    expect(readClientRegistrationRecovery({ getItem: fail })).toBeNull();
    expect(writeClientRegistrationRecovery({ setItem: fail }, "/clients")).toBe(false);
    expect(clearClientRegistrationRecovery({ removeItem: fail })).toBe(false);
  });
  it("clears only its own slot", () => {
    const storage = { removeItem: vi.fn() };
    expect(clearClientRegistrationRecovery(storage)).toBe(true);
    expect(storage.removeItem).toHaveBeenCalledExactlyOnceWith(key);
  });
});

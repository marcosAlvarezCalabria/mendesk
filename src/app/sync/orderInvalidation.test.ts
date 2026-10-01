import { describe, expect, it } from "vitest";
import { invalidationPaths, isSyncReadPath, parseInvalidationSignal } from "./orderInvalidation";

const clientId = "00000000-0000-4000-8000-000000000001";
const target = { kind: "order" as const, orderId: "00000000-0000-4000-8000-000000000002", orderNumber: "260907-0142", clientId };
const signal = { version: 1, eventId: "00000000-0000-4000-8000-000000000003", target };

describe("order invalidation", () => {
  it("invalidates every existing derived order read", () => {
    expect(invalidationPaths(target)).toEqual(["/orders", "/orders/260907-0142", "/orders/260907-0142/tickets", `/clients/${clientId}`, "/stats"]);
  });
  it("invalidates client-related reads without enumerating orders", () => {
    expect(invalidationPaths({ kind: "client", clientId })).toEqual(["/clients", `/clients/${clientId}`, "/orders", "/stats", "/orders/[orderNumber]", "/orders/[orderNumber]/tickets", "/appointments"]);
  });
  it.each(["/orders", "/orders/260907-0142", "/orders/260907-0142/tickets", "/clients", `/clients/${clientId}`, "/stats", "/appointments"])("refreshes %s", (path) => {
    expect(isSyncReadPath(path)).toBe(true);
  });
  it.each(["/orders/new", "/clients/new", "/login", "/lock", "/offline", "/kiosk", "/settings", "/orders/invalid", "/orders/260907-0142/edit", "/"])("excludes %s", (path) => {
    expect(isSyncReadPath(path)).toBe(false);
  });
  it("accepts only minimal order and client signals", () => {
    expect(parseInvalidationSignal(signal)).toEqual(signal);
    const clientSignal = { ...signal, target: { kind: "client", clientId } };
    expect(parseInvalidationSignal(clientSignal)).toEqual(clientSignal);
  });
  it.each([null, [], {}, { ...signal, version: 2 }, { ...signal, eventId: "invalid" }, { ...signal, snapshot: {} }, { ...signal, target: { ...target, phone: "353" } }, { ...signal, target: { ...target, orderNumber: "../login" } }, { ...signal, target: { ...target, clientId: "" } }])("rejects invalid or excessive messages %#", (value) => {
    expect(parseInvalidationSignal(value)).toBeNull();
  });
});

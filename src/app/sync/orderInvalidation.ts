import { IdempotencyKey } from "@/domain/values/IdempotencyKey";
import { OrderNumber } from "@/domain/values/OrderNumber";
import type { InvalidationSignal, InvalidationTarget } from "./contracts";

export function invalidationPaths(target: InvalidationTarget): readonly string[] {
  if (target.kind === "client") {
    return ["/clients", `/clients/${target.clientId}`, "/orders", "/stats", "/orders/[orderNumber]", "/orders/[orderNumber]/tickets", "/appointments"];
  }
  return ["/orders", `/orders/${target.orderNumber}`, `/orders/${target.orderNumber}/tickets`, `/clients/${target.clientId}`, "/stats"];
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).length === allowed.length && allowed.every((key) => Object.hasOwn(value, key));
}

function uuid(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  try { IdempotencyKey.fromString(value); return true; } catch { return false; }
}

function orderNumber(value: unknown): value is string {
  if (typeof value !== "string" || value !== value.trim()) return false;
  try { OrderNumber.fromString(value); return true; } catch { return false; }
}

export function parseInvalidationSignal(value: unknown): InvalidationSignal | null {
  if (!record(value) || !keys(value, ["version", "eventId", "target"]) || value.version !== 1 || !uuid(value.eventId)) return null;
  const target = value.target;
  if (!record(target) || !uuid(target.clientId)) return null;
  if (target.kind === "client" && keys(target, ["kind", "clientId"])) {
    return { version: 1, eventId: value.eventId, target: { kind: "client", clientId: target.clientId } };
  }
  if (target.kind === "order" && keys(target, ["kind", "orderId", "orderNumber", "clientId"]) && uuid(target.orderId) && orderNumber(target.orderNumber)) {
    return { version: 1, eventId: value.eventId, target: { kind: "order", orderId: target.orderId, orderNumber: target.orderNumber, clientId: target.clientId } };
  }
  return null;
}

export function isSyncReadPath(pathname: string): boolean {
  if (["/orders", "/clients", "/stats", "/appointments"].includes(pathname)) return true;
  const parts = pathname.split("/");
  if (parts[1] === "clients" && parts.length === 3) return uuid(parts[2]);
  return parts[1] === "orders" && orderNumber(parts[2]) && (parts.length === 3 || (parts.length === 4 && parts[3] === "tickets"));
}

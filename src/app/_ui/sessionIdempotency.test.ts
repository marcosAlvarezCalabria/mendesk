import { describe, expect, it } from "vitest";

import { clearSessionIdempotencyKey, clearSessionIdempotencySlot, restoreSessionIdempotencyKey, storeSessionIdempotencyKey } from "@/app/_ui/sessionIdempotency";

const UUID_A = "550e8400-e29b-41d4-a716-446655440000";
const UUID_B = "550e8400-e29b-41d4-a716-446655440001";

describe("session idempotency keys", () => {
  it("restores the same UUID after a reload in the same tab", () => {
    const storage = new MemoryStorage();
    expect(restoreSessionIdempotencyKey(storage, "order", UUID_A)).toBe(UUID_A);
    expect(restoreSessionIdempotencyKey(storage, "order", UUID_B)).toBe(UUID_A);
  });

  it("reuses the appointment UUID when a new form instance is mounted after reload or login", () => {
    const storage = new MemoryStorage();
    const slot = "koko:idempotency:appointment:new";
    expect(restoreSessionIdempotencyKey(storage, slot, UUID_A)).toBe(UUID_A);
    expect(restoreSessionIdempotencyKey(storage, slot, UUID_B)).toBe(UUID_A);
  });

  it("replaces malformed stored data without exposing form data", () => {
    const storage = new MemoryStorage([["order", "not-a-uuid"]]);
    expect(restoreSessionIdempotencyKey(storage, "order", UUID_A)).toBe(UUID_A);
    expect(storage.getItem("order")).toBe(UUID_A);
  });

  it("rotates only when the confirmed key still owns the slot", () => {
    const storage = new MemoryStorage([["order", UUID_A]]);
    expect(storeSessionIdempotencyKey(storage, "order", UUID_B, UUID_A)).toBe(true);
    expect(storage.getItem("order")).toBe(UUID_B);
    expect(storeSessionIdempotencyKey(storage, "order", UUID_A, UUID_A)).toBe(false);
    expect(storage.getItem("order")).toBe(UUID_B);
  });

  it("clears only the confirmed UUID", () => {
    const storage = new MemoryStorage([["order", UUID_A]]);
    expect(clearSessionIdempotencyKey(storage, "order", UUID_B)).toBe(false);
    expect(clearSessionIdempotencyKey(storage, "order", UUID_A)).toBe(true);
    expect(storage.getItem("order")).toBeNull();
  });

  it("clears an abandoned garment slot when its order is finalized", () => {
    const storage = new MemoryStorage([["garment:2", UUID_A]]);

    clearSessionIdempotencySlot(storage, "garment:2");

    expect(storage.getItem("garment:2")).toBeNull();
  });
});

class MemoryStorage implements Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  private readonly values = new Map<string, string>();

  constructor(entries: readonly (readonly [string, string])[] = []) {
    entries.forEach(([key, value]) => this.values.set(key, value));
  }

  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

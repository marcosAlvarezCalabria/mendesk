import { describe, expect, it } from "vitest";

import {
  auditDemoSeed,
  buildDemoSeed,
  demoSeedCollections,
  parseDemoSeedDate,
  provisionDemoSeed,
  type DemoSeedAdmin,
  type DemoSeedCollection,
  type DemoSeedInventory,
} from "./demo-seed.ts";
import { ALTERATION_TYPES } from "../../src/domain/values/AlterationType.ts";
import { isPaymentMethod } from "../../src/domain/values/PaymentMethod.ts";
import { isPaymentType } from "../../src/domain/values/PaymentType.ts";
import { PhoneNumber } from "../../src/domain/values/PhoneNumber.ts";

describe("Mendesk fictional demo seed", () => {
  const seed = buildDemoSeed(parseDemoSeedDate("2026-10-02"));

  it("creates a useful, varied and explicitly synthetic dataset", () => {
    expect(seed.clients).toHaveLength(24);
    expect(seed.orders).toHaveLength(36);
    expect(seed.garments.length).toBeGreaterThanOrEqual(60);
    expect(seed.payments.length).toBeGreaterThan(20);
    expect(seed.appointments).toHaveLength(16);
    expect(new Set(seed.orders.map((item) => item.status))).toEqual(
      new Set(["received", "ready", "collected", "cancelled"]),
    );
    expect(new Set(seed.appointments.map((item) => item.status))).toEqual(
      new Set(["scheduled", "completed", "cancelled"]),
    );
    expect(seed.clients.every((item) => String(item.notes).includes("Synthetic demo"))).toBe(true);
    expect(seed.garments.every((item) => ALTERATION_TYPES.includes(item.alteration_type as never))).toBe(true);
    expect(seed.payments.every((item) => isPaymentType(String(item.type)))).toBe(true);
    expect(seed.payments.every((item) => isPaymentMethod(String(item.method)))).toBe(true);
    expect(seed.clients.every((item) => PhoneNumber.fromRaw(String(item.phone)).value === item.phone)).toBe(true);
  });

  it("keeps every relation inside the fixture", () => {
    const clients = new Set(seed.clients.map((item) => item.id));
    const orders = new Set(seed.orders.map((item) => item.id));
    expect(seed.orders.every((item) => clients.has(String(item.client)))).toBe(true);
    expect(seed.garments.every((item) => orders.has(String(item.order)))).toBe(true);
    expect(seed.payments.every((item) => orders.has(String(item.order)))).toBe(true);
    expect(seed.appointments.every((item) => clients.has(String(item.client)))).toBe(true);
    expect(seed.appointments.every((item) => item.order_ === null || orders.has(String(item.order_)))).toBe(true);
  });

  it("uses deterministic unique identifiers", () => {
    const again = buildDemoSeed(parseDemoSeedDate("2026-10-02"));
    const ids = demoSeedCollections.flatMap((collection) => seed[collection].map((item) => item.id));
    expect(new Set(ids)).toHaveLength(ids.length);
    expect(again).toEqual(seed);
  });

  it("rejects ambiguous or impossible anchor dates", () => {
    expect(() => parseDemoSeedDate("02-10-2026")).toThrow("YYYY-MM-DD");
    expect(() => parseDemoSeedDate("2026-02-30")).toThrow("real calendar date");
  });

  it("creates missing records in dependency order and is idempotent", async () => {
    const admin = fakeAdmin(emptyInventory());
    const first = await provisionDemoSeed(admin, seed, { apply: true });
    expect(first.report.ok).toBe(true);
    expect(admin.writes.map((item) => item.collection)).toEqual([...demoSeedCollections]);

    const writesAfterFirstApply = admin.writes.length;
    const second = await provisionDemoSeed(admin, seed, { apply: true });
    expect(second.report.ok).toBe(true);
    expect(admin.writes).toHaveLength(writesAfterFirstApply);
  });

  it("reports exact missing counts without writing during audit", () => {
    const report = auditDemoSeed(seed, emptyInventory());
    expect(report.ok).toBe(false);
    expect(report.issues).toEqual(demoSeedCollections.map((collection) => ({
      code: "missing-records",
      collection,
      count: seed[collection].length,
    })));
  });
});

function emptyInventory(): DemoSeedInventory {
  return {
    clients: [],
    orders: [],
    garments: [],
    payments: [],
    appointments: [],
  };
}

function fakeAdmin(initial: DemoSeedInventory): DemoSeedAdmin & {
  writes: { collection: DemoSeedCollection; count: number }[];
} {
  const ids = Object.fromEntries(demoSeedCollections.map((collection) => [collection, new Set(initial[collection])])) as
    Record<DemoSeedCollection, Set<string>>;
  const writes: { collection: DemoSeedCollection; count: number }[] = [];
  return {
    writes,
    async readInventory() {
      return Object.fromEntries(demoSeedCollections.map((collection) => [collection, [...ids[collection]]])) as unknown as
        DemoSeedInventory;
    },
    async createRecords(collection, records) {
      writes.push({ collection, count: records.length });
      for (const record of records) ids[collection].add(record.id);
    },
  };
}

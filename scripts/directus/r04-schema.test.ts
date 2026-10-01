import { describe, expect, it, vi } from "vitest";

import {
  auditR04Data,
  provisionR04Schema,
  validateDirectusUrl,
  type R04DirectusAdmin,
} from "./r04-schema";

describe("auditR04Data", () => {
  it("reports only aggregate phone findings", () => {
    const report = auditR04Data({
      clients: [
        { name: "Ana", phone: "087 123 4567" },
        { name: "Bea", phone: "353871234567" },
        { name: "Cora", phone: null },
        { name: "Deleted client", phone: null },
        { name: "Dana", phone: "bad" },
      ],
      idempotency: { orders: [], garments: [], payments: [] },
      orderClients: [],
    });

    expect(report.phones).toEqual({
      total: 5,
      nonNormalized: 1,
      invalid: 1,
      activeNull: 1,
      duplicateGroups: 1,
      duplicateRows: 2,
    });
    expect(JSON.stringify(report)).not.toContain("087");
    expect(JSON.stringify(report)).not.toContain("Ana");
  });
  it("blocks blank client names and orders without a client without exposing record data", () => {
    const report = auditR04Data({
      clients: [
        { name: "   ", phone: "353871234567" },
        { name: null, phone: "353871234568" },
      ],
      orderClients: [null, "client-1"],
      idempotency: { orders: [], garments: [], payments: [] },
    });

    expect(report.integrity).toEqual({
      blankClientNames: 2,
      ordersWithoutClient: 1,
    });
    expect(report.safeToApply).toBe(false);
    expect(JSON.stringify(report)).not.toContain("client-1");
  });

  it("reports nullable historical keys and rejects malformed or duplicate keys", () => {
    const shared = "9baa4045-3888-4f01-9b6d-e97628b96306";
    const report = auditR04Data({
      clients: [],
      orderClients: [],
      idempotency: {
        orders: [null, shared, shared, "not-a-uuid"],
        garments: [null],
        payments: ["4fc11b58-ec20-4bcb-8aca-8b61df440dc2"],
      },
    });

    expect(report.idempotency.orders).toEqual({
      total: 4,
      null: 1,
      invalid: 1,
      duplicateGroups: 1,
      duplicateRows: 2,
    });
    expect(report.safeToApply).toBe(false);
    expect(JSON.stringify(report)).not.toContain(shared);
  });

  it("allows nullable historical keys when all present values are valid and unique", () => {
    const report = auditR04Data({
      clients: [{ name: "Deleted client", phone: null }],
      orderClients: [],
      idempotency: {
        orders: [null, "9baa4045-3888-4f01-9b6d-e97628b96306"],
        garments: [],
        payments: [],
      },
    });

    expect(report.safeToApply).toBe(true);
  });
});

describe("validateDirectusUrl", () => {
  it("accepts HTTPS endpoints", () => {
    expect(validateDirectusUrl("https://directus.example.com").protocol).toBe(
      "https:",
    );
  });

  it.each([
    "http://localhost:8055",
    "http://127.0.0.1:8055",
    "http://[::1]:8055",
  ])("accepts explicit HTTP loopback endpoint %s", (url) => {
    expect(validateDirectusUrl(url).protocol).toBe("http:");
  });

  it.each(["http://directus.example.com", "http://localhost.example.com"])(
    "rejects a non-loopback HTTP endpoint %s",
    (url) => {
      expect(() => validateDirectusUrl(url)).toThrow(
        "DIRECTUS_URL must use HTTPS unless the host is loopback",
      );
    },
  );
});

describe("provisionR04Schema", () => {
  it("does not request a missing idempotency field and counts those records as historical nulls", async () => {
    const admin = createAdmin({
      initialSchema: schemaFieldsWithMissingIdempotency(),
      historicalCounts: { orders: 2, garments: 1, payments: 0 },
    });

    const result = await provisionR04Schema(admin, { apply: true });

    expect(admin.readIdempotencyKeys).not.toHaveBeenCalled();
    expect(admin.countRecords).toHaveBeenCalledTimes(3);
    expect(result.data.idempotency.orders).toMatchObject({ total: 2, null: 2 });
    expect(result.data.idempotency.garments).toMatchObject({ total: 1, null: 1 });
    expect(result.data.safeToApply).toBe(true);
    expect(admin.upsertField).toHaveBeenCalledTimes(4);
    expect(result.applied).toBe(true);
  });

  it("audits only and never writes unless apply is explicit", async () => {
    const admin = createAdmin();

    const result = await provisionR04Schema(admin, { apply: false });

    expect(result.applied).toBe(false);
    expect(admin.upsertField).not.toHaveBeenCalled();
    expect(admin.readSchemaFields).toHaveBeenCalledTimes(2);
  });

  it("refuses apply before any schema write when data is unsafe", async () => {
    const admin = createAdmin({
      clients: [
        { name: "Ana", phone: "353871234567" },
        { name: "Bea", phone: "353871234567" },
      ],
    });

    await expect(provisionR04Schema(admin, { apply: true })).rejects.toThrow(
      "Data audit failed",
    );
    expect(admin.upsertField).not.toHaveBeenCalled();
  });

  it("upserts the four fields and verifies the final schema", async () => {
    const admin = createAdmin();

    const result = await provisionR04Schema(admin, { apply: true });

    expect(admin.upsertField).toHaveBeenCalledTimes(4);
    expect(admin.upsertField).toHaveBeenNthCalledWith(1, {
      collection: "clients",
      field: "phone",
      type: "string",
      nullable: true,
      unique: true,
      defaultValue: undefined,
    });
    expect(admin.upsertField).toHaveBeenNthCalledWith(2, {
      collection: "orders",
      field: "idempotency_key",
      type: "uuid",
      nullable: true,
      unique: true,
      defaultValue: null,
    });
    expect(result.applied).toBe(true);
    expect(result.schema.ok).toBe(true);
    expect(admin.readSchemaFields).toHaveBeenCalledTimes(2);
  });

  it("fails if final verification does not match the contract", async () => {
    const admin = createAdmin({ finalSchemaValid: false });

    await expect(provisionR04Schema(admin, { apply: true })).rejects.toThrow(
      "Final schema verification failed",
    );
  });
});

function createAdmin(
  options: {
    clients?: { name: string | null; phone: string | null }[];
    finalSchemaValid?: boolean;
    orderClients?: (string | null)[];
    initialSchema?: ReturnType<typeof schemaFields>;
    historicalCounts?: Partial<
      Record<"orders" | "garments" | "payments", number>
    >;
  } = {},
): R04DirectusAdmin & {
  readSchemaFields: ReturnType<typeof vi.fn>;
  upsertField: ReturnType<typeof vi.fn>;
} {
  let schemaRead = 0;
  const validSchema = schemaFields(true);
  const invalidSchema = schemaFields(false);
  const admin = {
    readOrderClientIds: vi.fn(async () => options.orderClients ?? []),
    readClients: vi.fn(async () => options.clients ?? []),
    readIdempotencyKeys: vi.fn(async () => []),
    countRecords: vi.fn(
      async (collection: "orders" | "garments" | "payments") =>
        options.historicalCounts?.[collection] ?? 0,
    ),
    readSchemaFields: vi.fn(async () => {
      schemaRead += 1;
      if (schemaRead === 1) return options.initialSchema ?? invalidSchema;
      return options.finalSchemaValid === false ? invalidSchema : validSchema;
    }),
    upsertField: vi.fn(async () => undefined),
  };
  return admin;
}

function schemaFields(valid: boolean) {
  return [
    {
      collection: "clients",
      field: "name",
      type: "string",
      schema: {
        is_nullable: false,
        is_unique: false,
        default_value: null,
      },
    },
    {
      collection: "orders",
      field: "client",
      type: "uuid",
      schema: {
        is_nullable: false,
        is_unique: false,
        default_value: null,
      },
    },
    {
      collection: "clients",
      field: "phone",
      type: "string",
      schema: {
        is_nullable: true,
        is_unique: valid,
        default_value: null,
      },
    },
    ...["orders", "garments", "payments"].map((collection) => ({
      collection,
      field: "idempotency_key",
      type: "uuid",
      schema: {
        is_nullable: true,
        is_unique: valid,
        default_value: null,
      },
    })),
  ];
}

function schemaFieldsWithMissingIdempotency() {
  return schemaFields(false).filter((field) => field.field !== "idempotency_key");
}

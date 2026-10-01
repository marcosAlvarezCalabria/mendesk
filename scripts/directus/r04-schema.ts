import {
  createDirectus,
  createField,
  readField,
  readFieldsByCollection,
  readItems,
  rest,
  staticToken,
  updateField,
} from "@directus/sdk";
import { pathToFileURL } from "node:url";

import {
  verifyR04SchemaContract,
  type DirectusSchemaFieldMetadata,
  type R04SchemaContractResult,
} from "../../src/infrastructure/directus/r04SchemaContract.ts";

const ANONYMIZED_CLIENT_NAME = "Deleted client";
const IDEMPOTENCY_COLLECTIONS = ["orders", "garments", "payments"] as const;

type IdempotencyCollection = (typeof IDEMPOTENCY_COLLECTIONS)[number];

export interface R04AuditInput {
  clients: readonly { name: string | null; phone: string | null }[];
  orderClients: readonly (string | null)[];
  idempotency: Record<IdempotencyCollection, readonly (string | null)[]>;
}

export interface AggregateValueAudit {
  total: number;
  null: number;
  invalid: number;
  duplicateGroups: number;
  duplicateRows: number;
}

export interface R04DataAuditReport {
  phones: {
    total: number;
    nonNormalized: number;
    invalid: number;
    activeNull: number;
    duplicateGroups: number;
    duplicateRows: number;
  };
  integrity: {
    blankClientNames: number;
    ordersWithoutClient: number;
  };
  idempotency: Record<IdempotencyCollection, AggregateValueAudit>;
  safeToApply: boolean;
}

export interface R04FieldDefinition {
  collection: "clients" | IdempotencyCollection;
  field: "phone" | "idempotency_key";
  type: "string" | "uuid";
  nullable: true;
  unique: true;
  defaultValue: null | undefined;
}

export interface R04DirectusAdmin {
  readClients(): Promise<{ name: string | null; phone: string | null }[]>;
  readOrderClientIds(): Promise<(string | null)[]>;
  readIdempotencyKeys(
    collection: IdempotencyCollection,
  ): Promise<(string | null)[]>;
  countRecords(collection: IdempotencyCollection): Promise<number>;
  readSchemaFields(): Promise<DirectusSchemaFieldMetadata[]>;
  upsertField(definition: R04FieldDefinition): Promise<void>;
}

export interface R04ProvisionResult {
  applied: boolean;
  data: R04DataAuditReport;
  schema: R04SchemaContractResult;
}

const FIELD_DEFINITIONS: readonly R04FieldDefinition[] = [
  {
    collection: "clients",
    field: "phone",
    type: "string",
    nullable: true,
    unique: true,
    defaultValue: undefined,
  },
  ...IDEMPOTENCY_COLLECTIONS.map((collection) => ({
    collection,
    field: "idempotency_key" as const,
    type: "uuid" as const,
    nullable: true as const,
    unique: true as const,
    defaultValue: null,
  })),
];

export function auditR04Data(input: R04AuditInput): R04DataAuditReport {
  const normalizedPhones: string[] = [];
  let nonNormalized = 0;
  let invalid = 0;
  let activeNull = 0;

  for (const client of input.clients) {
    if (client.phone === null) {
      if (client.name !== ANONYMIZED_CLIENT_NAME) activeNull += 1;
      continue;
    }

    const normalized = normalizePhone(client.phone);
    if (normalized === null) {
      invalid += 1;
      continue;
    }
    if (normalized !== client.phone) nonNormalized += 1;
    normalizedPhones.push(normalized);
  }

  const phoneDuplicates = duplicateCounts(normalizedPhones);
  const idempotency = {
    orders: auditKeys(input.idempotency.orders),
    garments: auditKeys(input.idempotency.garments),
    payments: auditKeys(input.idempotency.payments),
  };
  const phones = {
    total: input.clients.length,
    nonNormalized,
    invalid,
    activeNull,
    ...phoneDuplicates,
  };
  const integrity = {
    blankClientNames: input.clients.filter(
      (client) => typeof client.name !== "string" || !client.name.trim(),
    ).length,
    ordersWithoutClient: input.orderClients.filter(
      (clientId) => clientId === null,
    ).length,
  };
  const safeToApply =
    integrity.blankClientNames === 0 &&
    integrity.ordersWithoutClient === 0 &&
    phones.nonNormalized === 0 &&
    phones.invalid === 0 &&
    phones.activeNull === 0 &&
    phones.duplicateRows === 0 &&
    IDEMPOTENCY_COLLECTIONS.every(
      (collection) =>
        idempotency[collection].invalid === 0 &&
        idempotency[collection].duplicateRows === 0,
    );

  return { phones, integrity, idempotency, safeToApply };
}

export async function provisionR04Schema(
  admin: R04DirectusAdmin,
  options: { apply: boolean },
): Promise<R04ProvisionResult> {
  const initialFields = await admin.readSchemaFields();
  const readKeysOrHistoricalNulls = async (
    collection: IdempotencyCollection,
  ): Promise<(string | null)[]> => {
    const fieldExists = initialFields.some(
      (field) =>
        field.collection === collection && field.field === "idempotency_key",
    );
    if (fieldExists) return admin.readIdempotencyKeys(collection);
    return Array<string | null>(await admin.countRecords(collection)).fill(null);
  };
  const [clients, orderClients, orders, garments, payments] = await Promise.all([
    admin.readClients(),
    admin.readOrderClientIds(),
    readKeysOrHistoricalNulls("orders"),
    readKeysOrHistoricalNulls("garments"),
    readKeysOrHistoricalNulls("payments"),
  ]);
  const data = auditR04Data({
    clients,
    orderClients,
    idempotency: { orders, garments, payments },
  });
  const initialSchema = verifyR04SchemaContract(initialFields);

  if (!options.apply) {
    const schema = verifyR04SchemaContract(await admin.readSchemaFields());
    return { applied: false, data, schema };
  }
  if (!data.safeToApply) {
    throw new Error("Data audit failed; schema was not changed");
  }
  if (initialSchema.issues.some((issue) => issue.code === "wrong-type")) {
    throw new Error("Schema has an incompatible field type; schema was not changed");
  }

  for (const definition of FIELD_DEFINITIONS) {
    if (
      initialSchema.issues.some(
        (issue) =>
          issue.collection === definition.collection &&
          issue.field === definition.field,
      )
    ) {
      await admin.upsertField(definition);
    }
  }

  const schema = verifyR04SchemaContract(await admin.readSchemaFields());
  if (!schema.ok) {
    throw new Error("Final schema verification failed");
  }

  return { applied: true, data, schema };
}

function auditKeys(values: readonly (string | null)[]): AggregateValueAudit {
  const present = values.filter((value): value is string => value !== null);
  const valid = present.filter(isUuid);
  return {
    total: values.length,
    null: values.length - present.length,
    invalid: present.length - valid.length,
    ...duplicateCounts(valid.map((value) => value.toLowerCase())),
  };
}

function duplicateCounts(values: readonly string[]) {
  const occurrences = new Map<string, number>();
  for (const value of values) {
    occurrences.set(value, (occurrences.get(value) ?? 0) + 1);
  }
  const duplicates = [...occurrences.values()].filter((count) => count > 1);
  return {
    duplicateGroups: duplicates.length,
    duplicateRows: duplicates.reduce((total, count) => total + count, 0),
  };
}

function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("+")
    ? compact.slice(1)
    : compact.startsWith("00")
      ? compact.slice(2)
      : compact.startsWith("0")
        ? `353${compact.slice(1)}`
        : compact;
  return /^[1-9]\d{6,14}$/.test(normalized) ? normalized : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

type AdminSchema = {
  clients: { id: string; name: string | null; phone: string | null }[];
  orders: { id: string; client: string | null; idempotency_key?: string | null }[];
  garments: { id: string; idempotency_key?: string | null }[];
  payments: { id: string; idempotency_key?: string | null }[];
};

export function createR04DirectusAdmin(url: string, token: string): R04DirectusAdmin {
  const client = createDirectus<AdminSchema>(url)
    .with(staticToken(token))
    .with(rest());

  return {
    async readClients() {
      return (await client.request(
        readItems("clients", { fields: ["name", "phone"], limit: -1 }),
      )) as { name: string | null; phone: string | null }[];
    },

    async readOrderClientIds() {
      const rows = await client.request(
        readItems("orders", { fields: ["client"], limit: -1 }),
      );
      return rows.map((row) => row.client ?? null);
    },

    async readIdempotencyKeys(collection) {
      const rows =
        collection === "orders"
          ? await client.request(
              readItems("orders", {
                fields: ["idempotency_key"],
                limit: -1,
              }),
            )
          : collection === "garments"
            ? await client.request(
                readItems("garments", {
                  fields: ["idempotency_key"],
                  limit: -1,
                }),
              )
            : await client.request(
                readItems("payments", {
                  fields: ["idempotency_key"],
                  limit: -1,
                }),
              );
      return rows.map((row) => row.idempotency_key ?? null);
    },

    async countRecords(collection) {
      const rows =
        collection === "orders"
          ? await client.request(
              readItems("orders", { fields: ["id"], limit: -1 }),
            )
          : collection === "garments"
            ? await client.request(
                readItems("garments", { fields: ["id"], limit: -1 }),
              )
            : await client.request(
                readItems("payments", { fields: ["id"], limit: -1 }),
              );
      return rows.length;
    },

    async readSchemaFields() {
      const groups = await Promise.all(
        ["clients", ...IDEMPOTENCY_COLLECTIONS].map(async (collection) =>
          client.request(readFieldsByCollection(collection)),
        ),
      );
      return groups.flat().map((field) => ({
        collection: String(field.collection),
        field: String(field.field),
        type: String(field.type),
        schema: field.schema
          ? {
              is_nullable: field.schema.is_nullable ?? null,
              is_unique: field.schema.is_unique ?? null,
              default_value: field.schema.default_value,
            }
          : null,
      }));
    },

    async upsertField(definition) {
      const schema = {
        is_nullable: definition.nullable,
        is_unique: definition.unique,
        ...(definition.defaultValue !== undefined
          ? { default_value: definition.defaultValue }
          : {}),
      };
      try {
        await client.request(
          readField(definition.collection, definition.field),
        );
        await client.request(
          updateField(definition.collection, definition.field, { schema }),
        );
      } catch (error) {
        if (!isNotFound(error)) throw error;
        await client.request(
          createField(definition.collection, {
            field: definition.field,
            type: definition.type,
            schema,
          }),
        );
      }
    },
  };
}

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "status" in error &&
      error.status === 404,
  );
}

export function validateDirectusUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DIRECTUS_URL must be a valid URL");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (
    url.protocol !== "https:" &&
    !(url.protocol === "http:" && loopbackHosts.has(url.hostname))
  ) {
    throw new Error(
      "DIRECTUS_URL must use HTTPS unless the host is loopback",
    );
  }
  return url;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--apply" && arg !== "--audit")) {
    throw new Error("Usage: pnpm directus:r04:audit | pnpm directus:r04:apply");
  }
  const url = process.env.DIRECTUS_URL;
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!url || !token) {
    throw new Error("DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required");
  }
  validateDirectusUrl(url);

  const result = await provisionR04Schema(createR04DirectusAdmin(url, token), {
    apply: args.includes("--apply"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  runCli().catch((error: unknown) => {
    const safeMessage =
      error instanceof Error &&
      (error.message.startsWith("Usage:") ||
        error.message.startsWith("DIRECTUS_") ||
        error.message.startsWith("Data audit") ||
        error.message.startsWith("Schema has") ||
        error.message.startsWith("Final schema"))
        ? error.message
        : "Directus R04 operation failed; no record data was printed";
    process.stderr.write(`${safeMessage}\n`);
    process.exitCode = 1;
  });
}

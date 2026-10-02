import {
  createCollection,
  createDirectus,
  createField,
  createRelation,
  readCollections,
  readFields,
  readRelations,
  rest,
  staticToken,
} from "@directus/sdk";
import { pathToFileURL } from "node:url";

export const baseCollections = [
  { collection: "clients", icon: "group", singleton: false },
  { collection: "orders", icon: "receipt_long", singleton: false },
  { collection: "garments", icon: "checkroom", singleton: false },
  { collection: "payments", icon: "payments", singleton: false },
  { collection: "appointments", icon: "event", singleton: false },
  { collection: "order_sequences", icon: "tag", singleton: false },
  { collection: "shop_settings", icon: "storefront", singleton: true },
] as const;

export type BaseCollectionName = (typeof baseCollections)[number]["collection"];

export type BaseFieldDefinition = Readonly<{
  collection: BaseCollectionName;
  field: string;
  type: string;
  nullable: boolean;
  unique?: boolean;
  primary?: boolean;
  autoIncrement?: boolean;
  defaultValue?: unknown;
  special?: readonly string[];
  interface?: string;
  hidden?: boolean;
  readonly?: boolean;
  options?: Readonly<Record<string, unknown>>;
}>;

const statusChoices = (values: readonly string[]) => ({
  choices: values.map((value) => ({ text: value.replaceAll("_", " "), value })),
});

export const baseFields: readonly BaseFieldDefinition[] = [
  uuidPrimaryKey("clients"),
  field("clients", "name", "string", false, { interface: "input" }),
  field("clients", "phone", "string", true, { interface: "input", unique: true }),
  field("clients", "gdpr_consent", "boolean", false, { defaultValue: false, interface: "boolean" }),
  field("clients", "notes", "text", true, { interface: "input-multiline" }),
  createdAt("clients"),
  updatedAt("clients"),
  alias("clients", "orders"),
  alias("clients", "appointments"),

  uuidPrimaryKey("orders"),
  field("orders", "order_number", "string", false, { interface: "input", unique: true }),
  field("orders", "idempotency_key", "uuid", true, { unique: true }),
  manyToOne("orders", "client", false),
  field("orders", "status", "string", false, {
    defaultValue: "received",
    interface: "select-dropdown",
    options: statusChoices(["received", "ready", "collected", "cancelled"]),
  }),
  field("orders", "received_date", "timestamp", false, { interface: "datetime" }),
  field("orders", "due_date", "timestamp", false, { interface: "datetime" }),
  field("orders", "collected_at", "timestamp", true, { interface: "datetime" }),
  field("orders", "notes", "text", true, { interface: "input-multiline" }),
  createdAt("orders"),
  updatedAt("orders"),
  alias("orders", "garments"),
  alias("orders", "payments"),
  alias("orders", "appointments"),

  uuidPrimaryKey("garments"),
  manyToOne("garments", "order", false),
  field("garments", "idempotency_key", "uuid", true, { unique: true }),
  field("garments", "description", "string", false, { interface: "input" }),
  field("garments", "alteration_type", "string", false, { interface: "input" }),
  field("garments", "measurements", "text", true, { interface: "input-multiline" }),
  manyToOne("garments", "photo", true, "file-image"),
  field("garments", "price", "decimal", false, { interface: "input" }),
  createdAt("garments"),
  updatedAt("garments"),

  uuidPrimaryKey("payments"),
  manyToOne("payments", "order", false),
  field("payments", "idempotency_key", "uuid", true, { unique: true }),
  field("payments", "type", "string", false, {
    interface: "select-dropdown",
    options: statusChoices(["deposit", "balance", "refund"]),
  }),
  field("payments", "amount", "decimal", false, { interface: "input" }),
  field("payments", "method", "string", false, {
    interface: "select-dropdown",
    options: statusChoices(["cash", "card", "bank_transfer", "other"]),
  }),
  createdAt("payments"),

  uuidPrimaryKey("appointments"),
  manyToOne("appointments", "client", true),
  manyToOne("appointments", "order_", true),
  field("appointments", "scheduled_at", "timestamp", false, { interface: "datetime" }),
  field("appointments", "notes", "text", true, { interface: "input-multiline" }),
  field("appointments", "status", "string", false, {
    defaultValue: "scheduled",
    interface: "select-dropdown",
    options: statusChoices(["scheduled", "completed", "cancelled"]),
  }),
  createdAt("appointments"),

  integerPrimaryKey("order_sequences"),

  integerPrimaryKey("shop_settings"),
  field("shop_settings", "store_id", "string", false, { interface: "input", unique: true }),
  field("shop_settings", "name", "string", false, { interface: "input" }),
  field("shop_settings", "short_name", "string", false, { interface: "input" }),
  manyToOne("shop_settings", "logo", true, "file-image"),
  field("shop_settings", "panel_url", "string", false, { interface: "input" }),
  field("shop_settings", "review_url", "string", true, { interface: "input" }),
  field("shop_settings", "locales", "json", false, { interface: "tags" }),
  field("shop_settings", "default_locale", "string", false, { defaultValue: "en", interface: "input" }),
  field("shop_settings", "time_zone", "string", false, { defaultValue: "Europe/Dublin", interface: "input" }),
  field("shop_settings", "currency", "string", false, { defaultValue: "EUR", interface: "input" }),
  field("shop_settings", "calling_code", "string", false, { defaultValue: "353", interface: "input" }),
  field("shop_settings", "whatsapp_number", "string", true, { interface: "input" }),
  field("shop_settings", "ticket_footer", "text", true, { interface: "input-multiline" }),
] as const;

export type BaseRelationDefinition = Readonly<{
  collection: BaseCollectionName;
  field: string;
  relatedCollection: string;
  oneField: string | null;
  onDelete: "CASCADE" | "SET NULL" | "NO ACTION";
}>;

export const baseRelations: readonly BaseRelationDefinition[] = [
  relation("orders", "client", "clients", "orders", "NO ACTION"),
  relation("garments", "order", "orders", "garments", "CASCADE"),
  relation("garments", "photo", "directus_files", null, "SET NULL"),
  relation("payments", "order", "orders", "payments", "CASCADE"),
  relation("appointments", "client", "clients", "appointments", "SET NULL"),
  relation("appointments", "order_", "orders", "appointments", "SET NULL"),
  relation("shop_settings", "logo", "directus_files", null, "SET NULL"),
] as const;

export type SchemaInventory = Readonly<{
  collections: readonly string[];
  fields: readonly { collection: string; field: string; type: string }[];
  relations: readonly { collection: string; field: string; relatedCollection: string }[];
}>;

export type BaseSchemaIssue =
  | { code: "missing-collection"; collection: BaseCollectionName }
  | { code: "missing-field"; collection: BaseCollectionName; field: string }
  | { code: "wrong-field-type"; collection: BaseCollectionName; field: string; expected: string; actual: string }
  | { code: "missing-relation"; collection: BaseCollectionName; field: string; relatedCollection: string };

export type BaseSchemaReport = Readonly<{ ok: boolean; issues: readonly BaseSchemaIssue[] }>;

export interface BaseSchemaAdmin {
  readInventory(): Promise<SchemaInventory>;
  createCollection(definition: (typeof baseCollections)[number], primaryKey: BaseFieldDefinition): Promise<void>;
  createField(definition: BaseFieldDefinition): Promise<void>;
  createRelation(definition: BaseRelationDefinition): Promise<void>;
}

export function auditBaseSchema(inventory: SchemaInventory): BaseSchemaReport {
  const issues: BaseSchemaIssue[] = [];
  const collections = new Set(inventory.collections);
  const fields = new Map(inventory.fields.map((item) => [`${item.collection}.${item.field}`, item.type]));
  const relations = new Set(
    inventory.relations.map((item) => `${item.collection}.${item.field}->${item.relatedCollection}`),
  );

  for (const definition of baseCollections) {
    if (!collections.has(definition.collection)) {
      issues.push({ code: "missing-collection", collection: definition.collection });
    }
  }
  for (const definition of baseFields) {
    if (!collections.has(definition.collection)) continue;
    const key = `${definition.collection}.${definition.field}`;
    const actual = fields.get(key);
    if (!actual) {
      issues.push({ code: "missing-field", collection: definition.collection, field: definition.field });
    } else if (actual !== definition.type) {
      issues.push({
        code: "wrong-field-type",
        collection: definition.collection,
        field: definition.field,
        expected: definition.type,
        actual,
      });
    }
  }
  for (const definition of baseRelations) {
    if (!collections.has(definition.collection)) continue;
    const key = `${definition.collection}.${definition.field}->${definition.relatedCollection}`;
    if (!relations.has(key)) {
      issues.push({
        code: "missing-relation",
        collection: definition.collection,
        field: definition.field,
        relatedCollection: definition.relatedCollection,
      });
    }
  }
  return { ok: issues.length === 0, issues };
}

export async function provisionBaseSchema(
  admin: BaseSchemaAdmin,
  options: { apply: boolean },
): Promise<{ applied: boolean; report: BaseSchemaReport }> {
  let inventory = await admin.readInventory();
  let report = auditBaseSchema(inventory);
  if (!options.apply) return { applied: false, report };
  if (report.issues.some((issue) => issue.code === "wrong-field-type")) {
    throw new Error("Base schema has incompatible field types; schema was not changed");
  }

  const existingCollections = new Set(inventory.collections);
  for (const definition of baseCollections) {
    if (!existingCollections.has(definition.collection)) {
      await admin.createCollection(definition, primaryKeyFor(definition.collection));
    }
  }

  inventory = await admin.readInventory();
  const existingFields = new Set(inventory.fields.map((item) => `${item.collection}.${item.field}`));
  for (const definition of baseFields) {
    const key = `${definition.collection}.${definition.field}`;
    if (!existingFields.has(key)) await admin.createField(definition);
  }

  inventory = await admin.readInventory();
  const existingRelations = new Set(
    inventory.relations.map((item) => `${item.collection}.${item.field}->${item.relatedCollection}`),
  );
  for (const definition of baseRelations) {
    const key = `${definition.collection}.${definition.field}->${definition.relatedCollection}`;
    if (!existingRelations.has(key)) await admin.createRelation(definition);
  }

  report = auditBaseSchema(await admin.readInventory());
  if (!report.ok) throw new Error("Final base schema verification failed");
  return { applied: true, report };
}

export function createBaseSchemaAdmin(url: string, token: string): BaseSchemaAdmin {
  const client = createDirectus<Record<string, unknown[]>>(url).with(staticToken(token)).with(rest());
  return {
    async readInventory() {
      const [collections, fields, relations] = await Promise.all([
        client.request(readCollections()),
        client.request(readFields()),
        client.request(readRelations()),
      ]);
      return {
        collections: collections.map((item) => String(item.collection)),
        fields: fields.map((item) => ({
          collection: String(item.collection),
          field: String(item.field),
          type: String(item.type),
        })),
        relations: relations.map((item) => ({
          collection: String(item.collection),
          field: String(item.field),
          relatedCollection: String(item.related_collection),
        })),
      };
    },
    async createCollection(definition, primaryKey) {
      await client.request(
        createCollection({
          collection: definition.collection,
          meta: {
            icon: definition.icon,
            singleton: definition.singleton,
            note: "Managed by Mendesk base schema provisioning.",
          },
          schema: { name: definition.collection },
          fields: [toFieldPayload(primaryKey)],
        } as never),
      );
    },
    async createField(definition) {
      await client.request(createField(definition.collection, toFieldPayload(definition) as never));
    },
    async createRelation(definition) {
      await client.request(
        createRelation({
          collection: definition.collection,
          field: definition.field,
          related_collection: definition.relatedCollection,
          meta: {
            many_collection: definition.collection,
            many_field: definition.field,
            one_collection: definition.relatedCollection,
            one_field: definition.oneField,
            one_deselect_action: "nullify",
          },
          schema: { on_delete: definition.onDelete, on_update: "NO ACTION" },
        } as never),
      );
    },
  };
}

function toFieldPayload(definition: BaseFieldDefinition) {
  const isAlias = definition.type === "alias";
  return {
    field: definition.field,
    type: definition.type,
    meta: {
      special: definition.special ? [...definition.special] : null,
      interface: definition.interface ?? null,
      options: definition.options ?? null,
      required: !definition.nullable,
      hidden: definition.hidden ?? false,
      readonly: definition.readonly ?? false,
    },
    schema: isAlias
      ? null
      : {
          is_nullable: definition.nullable,
          is_unique: definition.unique ?? false,
          is_primary_key: definition.primary ?? false,
          has_auto_increment: definition.autoIncrement ?? false,
          ...(definition.defaultValue !== undefined ? { default_value: definition.defaultValue } : {}),
          ...(definition.type === "decimal" ? { numeric_precision: 12, numeric_scale: 2 } : {}),
        },
  };
}

function primaryKeyFor(collection: BaseCollectionName): BaseFieldDefinition {
  const primaryKey = baseFields.find((definition) => definition.collection === collection && definition.primary);
  if (!primaryKey) throw new Error(`Missing primary key definition for ${collection}`);
  return primaryKey;
}

function field(
  collection: BaseCollectionName,
  name: string,
  type: string,
  nullable: boolean,
  options: Partial<Omit<BaseFieldDefinition, "collection" | "field" | "type" | "nullable">> = {},
): BaseFieldDefinition {
  return { collection, field: name, type, nullable, ...options };
}

function uuidPrimaryKey(collection: BaseCollectionName): BaseFieldDefinition {
  return field(collection, "id", "uuid", false, {
    primary: true,
    hidden: true,
    readonly: true,
    special: ["uuid"],
    interface: "input",
  });
}

function integerPrimaryKey(collection: BaseCollectionName): BaseFieldDefinition {
  return field(collection, "id", "integer", false, {
    primary: true,
    autoIncrement: true,
    hidden: true,
    readonly: true,
    interface: "input",
  });
}

function manyToOne(
  collection: BaseCollectionName,
  name: string,
  nullable: boolean,
  interfaceName = "select-dropdown-m2o",
): BaseFieldDefinition {
  return field(collection, name, "uuid", nullable, { special: ["m2o"], interface: interfaceName });
}

function alias(collection: BaseCollectionName, name: string): BaseFieldDefinition {
  return field(collection, name, "alias", true, { special: ["o2m"], interface: "list-o2m" });
}

function createdAt(collection: BaseCollectionName): BaseFieldDefinition {
  return field(collection, "date_created", "timestamp", true, {
    special: ["date-created"],
    interface: "datetime",
    readonly: true,
  });
}

function updatedAt(collection: BaseCollectionName): BaseFieldDefinition {
  return field(collection, "date_updated", "timestamp", true, {
    special: ["date-updated"],
    interface: "datetime",
    readonly: true,
  });
}

function relation(
  collection: BaseCollectionName,
  name: string,
  relatedCollection: string,
  oneField: string | null,
  onDelete: BaseRelationDefinition["onDelete"],
): BaseRelationDefinition {
  return { collection, field: name, relatedCollection, oneField, onDelete };
}

export function validateDirectusUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("DIRECTUS_URL must be a valid URL");
  }
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopbackHosts.has(url.hostname))) {
    throw new Error("DIRECTUS_URL must use HTTPS unless the host is loopback");
  }
  return url;
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || (args[0] !== "--audit" && args[0] !== "--apply")) {
    throw new Error("Usage: pnpm directus:schema:audit | pnpm directus:schema:apply");
  }
  const url = process.env.DIRECTUS_URL;
  const token = process.env.DIRECTUS_ADMIN_TOKEN;
  if (!url || !token) throw new Error("DIRECTUS_URL and DIRECTUS_ADMIN_TOKEN are required");
  validateDirectusUrl(url);
  const result = await provisionBaseSchema(createBaseSchemaAdmin(url, token), {
    apply: args[0] === "--apply",
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Directus base schema operation failed";
    const safe = /^(Usage:|DIRECTUS_|Base schema|Final base schema)/.test(message)
      ? message
      : "Directus base schema operation failed; no record data was printed";
    process.stderr.write(`${safe}\n`);
    process.exitCode = 1;
  });
}

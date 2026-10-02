import { describe, expect, it } from "vitest";

import {
  auditBaseSchema,
  baseCollections,
  baseFields,
  baseRelations,
  provisionBaseSchema,
  validateDirectusUrl,
  type BaseFieldDefinition,
  type BaseRelationDefinition,
  type BaseSchemaAdmin,
  type SchemaInventory,
} from "./base-schema";

describe("Mendesk base Directus schema", () => {
  it("covers every collection and relation required by the application", () => {
    expect(baseCollections.map((item) => item.collection)).toEqual([
      "clients",
      "orders",
      "garments",
      "payments",
      "appointments",
      "order_sequences",
      "shop_settings",
    ]);
    expect(baseRelations.map((item) => `${item.collection}.${item.field}`)).toEqual([
      "orders.client",
      "garments.order",
      "garments.photo",
      "payments.order",
      "appointments.client",
      "appointments.order_",
      "shop_settings.logo",
    ]);
    for (const collection of baseCollections) {
      expect(baseFields.some((item) => item.collection === collection.collection && item.primary)).toBe(true);
    }
  });

  it("reports missing collections without inventing field-level noise", () => {
    const report = auditBaseSchema({ collections: [], fields: [], relations: [] });
    expect(report.ok).toBe(false);
    expect(report.issues).toHaveLength(baseCollections.length);
    expect(report.issues.every((issue) => issue.code === "missing-collection")).toBe(true);
  });

  it("includes the editable workshop profile and first-run completion marker", () => {
    const settings = baseFields
      .filter((item) => item.collection === "shop_settings")
      .map((item) => ({ field: item.field, nullable: item.nullable, readonly: item.readonly ?? false, type: item.type }));

    expect(settings).toEqual(expect.arrayContaining([
      { field: "contact_email", nullable: true, readonly: false, type: "string" },
      { field: "contact_phone", nullable: true, readonly: false, type: "string" },
      { field: "whatsapp_number", nullable: true, readonly: false, type: "string" },
      { field: "address", nullable: true, readonly: false, type: "text" },
      { field: "ticket_footer", nullable: true, readonly: false, type: "text" },
      { field: "setup_completed_at", nullable: true, readonly: true, type: "timestamp" },
    ]));
  });

  it("refuses incompatible field types before writing", async () => {
    const admin = fakeAdmin(fullInventory({ typeOverride: { key: "clients.phone", type: "integer" } }));
    await expect(provisionBaseSchema(admin, { apply: true })).rejects.toThrow(
      "Base schema has incompatible field types",
    );
    expect(admin.writes).toEqual([]);
  });

  it("creates an empty schema and is idempotent", async () => {
    const admin = fakeAdmin({ collections: [], fields: [], relations: [] });
    const first = await provisionBaseSchema(admin, { apply: true });
    expect(first.report.ok).toBe(true);
    expect(admin.writes.filter((write) => write.startsWith("collection:"))).toHaveLength(baseCollections.length);
    expect(admin.writes.filter((write) => write.startsWith("relation:"))).toHaveLength(baseRelations.length);

    const writesAfterFirstApply = admin.writes.length;
    const second = await provisionBaseSchema(admin, { apply: true });
    expect(second.report.ok).toBe(true);
    expect(admin.writes).toHaveLength(writesAfterFirstApply);
  });

  it("allows plain HTTP only for loopback provisioning", () => {
    expect(validateDirectusUrl("http://127.0.0.1:8055").hostname).toBe("127.0.0.1");
    expect(validateDirectusUrl("https://directus.example.com").protocol).toBe("https:");
    expect(() => validateDirectusUrl("http://directus.example.com")).toThrow("must use HTTPS");
  });
});

function fullInventory(options?: { typeOverride?: { key: string; type: string } }): SchemaInventory {
  return {
    collections: baseCollections.map((item) => item.collection),
    fields: baseFields.map((item) => ({
      collection: item.collection,
      field: item.field,
      type:
        options?.typeOverride?.key === `${item.collection}.${item.field}`
          ? options.typeOverride.type
          : item.type,
    })),
    relations: baseRelations.map((item) => ({
      collection: item.collection,
      field: item.field,
      relatedCollection: item.relatedCollection,
    })),
  };
}

function fakeAdmin(initial: SchemaInventory): BaseSchemaAdmin & { writes: string[] } {
  const collections = new Set(initial.collections);
  const fields = new Map(initial.fields.map((item) => [`${item.collection}.${item.field}`, item.type]));
  const relations = new Map(
    initial.relations.map((item) => [
      `${item.collection}.${item.field}->${item.relatedCollection}`,
      item,
    ]),
  );
  const writes: string[] = [];
  return {
    writes,
    async readInventory() {
      return {
        collections: [...collections],
        fields: [...fields].map(([key, type]) => {
          const separator = key.indexOf(".");
          return { collection: key.slice(0, separator), field: key.slice(separator + 1), type };
        }),
        relations: [...relations.values()],
      };
    },
    async createCollection(definition, primaryKey) {
      writes.push(`collection:${definition.collection}`);
      collections.add(definition.collection);
      fields.set(`${definition.collection}.${primaryKey.field}`, primaryKey.type);
    },
    async createField(definition: BaseFieldDefinition) {
      writes.push(`field:${definition.collection}.${definition.field}`);
      fields.set(`${definition.collection}.${definition.field}`, definition.type);
    },
    async createRelation(definition: BaseRelationDefinition) {
      writes.push(`relation:${definition.collection}.${definition.field}`);
      relations.set(`${definition.collection}.${definition.field}->${definition.relatedCollection}`, {
        collection: definition.collection,
        field: definition.field,
        relatedCollection: definition.relatedCollection,
      });
    },
  };
}

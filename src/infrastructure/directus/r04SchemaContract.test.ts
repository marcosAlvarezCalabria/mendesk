import { describe, expect, it } from "vitest";

import {
  verifyR04SchemaContract,
  type DirectusSchemaFieldMetadata,
} from "@/infrastructure/directus/r04SchemaContract";

describe("verifyR04SchemaContract", () => {
  it("accepts the operational integrity fields and nullable unique technical fields", () => {
    expect(verifyR04SchemaContract(validMetadata())).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("reports a required field that is missing", () => {
    const metadata = validMetadata().filter(
      ({ collection, field }) =>
        !(collection === "payments" && field === "idempotency_key"),
    );

    expect(verifyR04SchemaContract(metadata)).toEqual({
      ok: false,
      issues: [
        {
          code: "missing-field",
          collection: "payments",
          field: "idempotency_key",
          expected: "field to exist",
          actual: "missing",
        },
      ],
    });
  });

  it("reports an idempotency key with the wrong Directus type", () => {
    const metadata = replaceField(validMetadata(), "orders", "idempotency_key", {
      type: "string",
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "wrong-type",
      collection: "orders",
      field: "idempotency_key",
      expected: "uuid",
      actual: "string",
    });
  });

  it("reports a client phone with the wrong Directus type", () => {
    const metadata = replaceField(validMetadata(), "clients", "phone", {
      type: "integer",
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "wrong-type",
      collection: "clients",
      field: "phone",
      expected: "string",
      actual: "integer",
    });
  });

  it("reports a nullable client name", () => {
    const metadata = replaceField(validMetadata(), "clients", "name", {
      schema: { is_nullable: true, is_unique: false, default_value: null },
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "must-not-be-nullable",
      collection: "clients",
      field: "name",
      expected: false,
      actual: true,
    });
  });

  it("reports a nullable or unique order client relation", () => {
    const metadata = replaceField(validMetadata(), "orders", "client", {
      schema: { is_nullable: true, is_unique: true, default_value: null },
    });

    expect(verifyR04SchemaContract(metadata).issues).toEqual(
      expect.arrayContaining([
        {
          code: "must-not-be-nullable",
          collection: "orders",
          field: "client",
          expected: false,
          actual: true,
        },
        {
          code: "must-not-be-unique",
          collection: "orders",
          field: "client",
          expected: false,
          actual: true,
        },
      ]),
    );
  });

  it("reports a client phone that is not nullable", () => {
    const metadata = replaceField(validMetadata(), "clients", "phone", {
      schema: { is_nullable: false, is_unique: true, default_value: null },
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "must-be-nullable",
      collection: "clients",
      field: "phone",
      expected: true,
      actual: false,
    });
  });

  it("reports an idempotency key that is not nullable", () => {
    const metadata = replaceField(validMetadata(), "garments", "idempotency_key", {
      schema: { is_nullable: false, is_unique: true, default_value: null },
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "must-be-nullable",
      collection: "garments",
      field: "idempotency_key",
      expected: true,
      actual: false,
    });
  });

  it("reports a required field that is not unique", () => {
    const metadata = replaceField(validMetadata(), "payments", "idempotency_key", {
      schema: { is_nullable: true, is_unique: false, default_value: null },
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "must-be-unique",
      collection: "payments",
      field: "idempotency_key",
      expected: true,
      actual: false,
    });
  });

  it("reports an idempotency key with a non-null default", () => {
    const metadata = replaceField(validMetadata(), "orders", "idempotency_key", {
      schema: {
        is_nullable: true,
        is_unique: true,
        default_value: "00000000-0000-0000-0000-000000000000",
      },
    });

    expect(verifyR04SchemaContract(metadata).issues).toContainEqual({
      code: "incompatible-default",
      collection: "orders",
      field: "idempotency_key",
      expected: null,
      actual: "00000000-0000-0000-0000-000000000000",
    });
  });

  it("reports every incompatible property in deterministic contract order", () => {
    const metadata = replaceField(validMetadata(), "orders", "idempotency_key", {
      type: "string",
      schema: { is_nullable: false, is_unique: false, default_value: "generated" },
    });

    expect(verifyR04SchemaContract(metadata)).toEqual({
      ok: false,
      issues: [
        {
          code: "wrong-type",
          collection: "orders",
          field: "idempotency_key",
          expected: "uuid",
          actual: "string",
        },
        {
          code: "must-be-nullable",
          collection: "orders",
          field: "idempotency_key",
          expected: true,
          actual: false,
        },
        {
          code: "must-be-unique",
          collection: "orders",
          field: "idempotency_key",
          expected: true,
          actual: false,
        },
        {
          code: "incompatible-default",
          collection: "orders",
          field: "idempotency_key",
          expected: null,
          actual: "generated",
        },
      ],
    });
  });
});

function validMetadata(): DirectusSchemaFieldMetadata[] {
  return [
    field("clients", "phone", "string"),
    field("clients", "name", "string", {
      is_nullable: false,
      is_unique: false,
      default_value: null,
    }),
    field("orders", "client", "uuid", {
      is_nullable: false,
      is_unique: false,
      default_value: null,
    }),
    field("orders", "idempotency_key", "uuid"),
    field("garments", "idempotency_key", "uuid"),
    field("payments", "idempotency_key", "uuid"),
  ];
}

function field(
  collection: string,
  name: string,
  type: string,
  schema: NonNullable<DirectusSchemaFieldMetadata["schema"]> = { is_nullable: true, is_unique: true, default_value: null },
): DirectusSchemaFieldMetadata {
  return {
    collection,
    field: name,
    type,
    schema,
  };
}

function replaceField(
  metadata: DirectusSchemaFieldMetadata[],
  collection: string,
  fieldName: string,
  replacement: Partial<DirectusSchemaFieldMetadata>,
): DirectusSchemaFieldMetadata[] {
  return metadata.map((candidate) =>
    candidate.collection === collection && candidate.field === fieldName
      ? { ...candidate, ...replacement }
      : candidate,
  );
}

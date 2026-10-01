export interface DirectusSchemaFieldMetadata {
  collection: string;
  field: string;
  type: string;
  schema: {
    is_nullable: boolean | null;
    is_unique: boolean | null;
    default_value: unknown;
  } | null;
}

export type R04SchemaContractIssueCode =
  | "missing-field"
  | "wrong-type"
  | "must-be-nullable"
  | "must-be-unique"
  | "must-not-be-nullable"
  | "must-not-be-unique"
  | "incompatible-default";

export interface R04SchemaContractIssue {
  code: R04SchemaContractIssueCode;
  collection: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

export interface R04SchemaContractResult {
  ok: boolean;
  issues: R04SchemaContractIssue[];
}

interface RequiredFieldContract {
  collection: string;
  field: string;
  type?: string;
  nullable: boolean;
  unique: boolean;
  defaultValue?: null;
}

const REQUIRED_FIELDS: readonly RequiredFieldContract[] = [
  {
    collection: "clients",
    field: "name",
    type: "string",
    nullable: false,
    unique: false,
  },
  {
    collection: "orders",
    field: "client",
    type: "uuid",
    nullable: false,
    unique: false,
  },
  {
    collection: "clients",
    field: "phone",
    type: "string",
    nullable: true,
    unique: true,
  },
  ...["orders", "garments", "payments"].map((collection) => ({
    collection,
    field: "idempotency_key",
    type: "uuid",
    nullable: true as const,
    unique: true as const,
    defaultValue: null,
  })),
];

export function verifyR04SchemaContract(
  fields: readonly DirectusSchemaFieldMetadata[],
): R04SchemaContractResult {
  const issues: R04SchemaContractIssue[] = [];

  for (const contract of REQUIRED_FIELDS) {
    const field = fields.find(
      (candidate) =>
        candidate.collection === contract.collection &&
        candidate.field === contract.field,
    );

    if (!field) {
      issues.push({
        code: "missing-field",
        collection: contract.collection,
        field: contract.field,
        expected: "field to exist",
        actual: "missing",
      });
      continue;
    }

    if (contract.type !== undefined && field.type !== contract.type) {
      issues.push(
        issue(contract, "wrong-type", contract.type, field.type),
      );
    }

    if (field.schema?.is_nullable !== contract.nullable) {
      issues.push(
        issue(
          contract,
          contract.nullable ? "must-be-nullable" : "must-not-be-nullable",
          contract.nullable,
          field.schema?.is_nullable,
        ),
      );
    }

    if (field.schema?.is_unique !== contract.unique) {
      issues.push(
        issue(
          contract,
          contract.unique ? "must-be-unique" : "must-not-be-unique",
          contract.unique,
          field.schema?.is_unique,
        ),
      );
    }

    if (
      "defaultValue" in contract &&
      field.schema?.default_value !== contract.defaultValue
    ) {
      issues.push(
        issue(
          contract,
          "incompatible-default",
          contract.defaultValue,
          field.schema?.default_value,
        ),
      );
    }
  }

  return { ok: issues.length === 0, issues };
}

function issue(
  contract: RequiredFieldContract,
  code: R04SchemaContractIssueCode,
  expected: unknown,
  actual: unknown,
): R04SchemaContractIssue {
  return {
    code,
    collection: contract.collection,
    field: contract.field,
    expected,
    actual,
  };
}

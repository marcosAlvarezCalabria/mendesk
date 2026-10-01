import { MutationConfirmedNotSavedError } from "@/application/mutations/MutationConfirmedNotSavedError";
import { MutationOutcomeUnknownError } from "@/application/mutations/MutationOutcomeUnknownError";
import { IdempotencyConflictError } from "@/domain/errors/IdempotencyConflictError";

export type IdempotentCreate<T> = Readonly<{
  lookup: () => Promise<T | null>;
  create: () => Promise<T>;
  isCompatible: (value: T) => boolean;
}>;

export async function createIdempotently<T>(operation: IdempotentCreate<T>): Promise<T> {
  const existing = await operation.lookup();

  if (existing) {
    return acceptCompatible(existing, operation.isCompatible);
  }

  let created: T;
  try {
    created = await operation.create();
  } catch (createError) {
    return reconcileAfterFailedCreate(operation, createError);
  }

  return acceptCompatible(created, operation.isCompatible);
}

async function reconcileAfterFailedCreate<T>(operation: IdempotentCreate<T>, createError: unknown): Promise<T> {
  let existing: T | null;
  try {
    existing = await operation.lookup();
  } catch (reconciliationError) {
    throw new MutationOutcomeUnknownError({
      cause: new AggregateError([createError, reconciliationError], "Mutation and reconciliation both failed"),
    });
  }

  if (!existing) {
    throw new MutationConfirmedNotSavedError({ cause: createError });
  }

  return acceptCompatible(existing, operation.isCompatible);
}

function acceptCompatible<T>(value: T, isCompatible: (value: T) => boolean): T {
  if (!isCompatible(value)) throw new IdempotencyConflictError();
  return value;
}

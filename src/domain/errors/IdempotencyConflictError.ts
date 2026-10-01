export class IdempotencyConflictError extends Error {
  constructor(readonly mismatchedFields: readonly string[] = [], readonly mismatchDetails: readonly string[] = []) {
    super("The idempotency key is already associated with different content.");
    this.name = "IdempotencyConflictError";
  }
}

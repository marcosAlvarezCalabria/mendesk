export class InvalidIdempotencyKeyError extends Error {
  constructor() {
    super("Invalid idempotency key.");
    this.name = "InvalidIdempotencyKeyError";
  }
}

import { InvalidIdempotencyKeyError } from "@/domain/errors/InvalidIdempotencyKeyError";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdempotencyKey {
  private constructor(readonly value: string) {}

  static fromString(value: string): IdempotencyKey {
    const normalized = value.trim().toLowerCase();

    if (!UUID_PATTERN.test(normalized)) {
      throw new InvalidIdempotencyKeyError();
    }

    return new IdempotencyKey(normalized);
  }

  toString(): string {
    return this.value;
  }
}

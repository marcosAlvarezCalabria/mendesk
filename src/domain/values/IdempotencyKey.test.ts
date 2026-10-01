import { describe, expect, it } from "vitest";

import { InvalidIdempotencyKeyError } from "@/domain/errors/InvalidIdempotencyKeyError";
import { IdempotencyKey } from "@/domain/values/IdempotencyKey";

describe("IdempotencyKey", () => {
  it("accepts a canonical UUID", () => {
    expect(IdempotencyKey.fromString("550e8400-e29b-41d4-a716-446655440000").value).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it("normalizes surrounding whitespace and letter case", () => {
    expect(IdempotencyKey.fromString(" 550E8400-E29B-41D4-A716-446655440000 ").value).toBe(
      "550e8400-e29b-41d4-a716-446655440000",
    );
  });

  it.each(["", "not-a-uuid", "00000000-0000-0000-0000-000000000000", "550e8400-e29b-41d4-c716-446655440000"])(
    "rejects invalid UUID value %j",
    (value) => {
      expect(() => IdempotencyKey.fromString(value)).toThrow(InvalidIdempotencyKeyError);
    },
  );
});

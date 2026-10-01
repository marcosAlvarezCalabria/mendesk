import { describe, expect, it } from "vitest";

import { toAlterationType } from "@/domain/values/AlterationType";

describe("toAlterationType", () => {
  it("keeps known alteration types", () => {
    expect(toAlterationType("hem")).toBe("hem");
    expect(toAlterationType("take_in")).toBe("take_in");
  });

  it("falls back to other for unknown or empty values", () => {
    expect(toAlterationType("zzz")).toBe("other");
    expect(toAlterationType("")).toBe("other");
  });
});

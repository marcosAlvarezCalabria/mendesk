import { describe, expect, it } from "vitest";

import { bootstrapOk } from "@/domain/bootstrap";

describe("bootstrapOk", () => {
  it("confirms the test pipeline is wired", () => {
    expect(bootstrapOk()).toBe(true);
  });
});
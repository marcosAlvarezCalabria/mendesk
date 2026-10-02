import { describe, expect, it } from "vitest";

import { idempotencyKeys, technicalKeys } from "@/config/technicalKeys";

describe("Mendesk technical namespace", () => {
  it("owns cookies, browser storage and synchronization identifiers", () => {
    const identifiers = [
      ...Object.values(technicalKeys),
      idempotencyKeys.newOrder,
      idempotencyKeys.newOrderPayment,
      idempotencyKeys.newOrderGarment(1),
      idempotencyKeys.addGarment("order"),
      idempotencyKeys.collectOrder("order"),
      idempotencyKeys.payment("order"),
    ];
    expect(identifiers.every((identifier) => identifier.startsWith("mendesk"))).toBe(true);
    expect(identifiers.join(" ")).not.toMatch(/koko|nika|incamdi|incandi/i);
  });
});

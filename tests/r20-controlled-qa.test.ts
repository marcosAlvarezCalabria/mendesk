import { describe, expect, it } from "vitest";

import {
  ControlledGarmentRepairScenario,
  ControlledOrderConfirmationScenario,
  ControlledPaymentScenario,
  ControlledPhotoRetryScenario,
  KnownPaymentsStatsScenario,
} from "./fixtures/r20ControlledQa";

describe("R20 controlled QA scenarios", () => {
  it("QA #32 keeps one order, its garments and its deposit after a double confirmation", async () => {
    const scenario = new ControlledOrderConfirmationScenario();

    const confirmations = await Promise.all([scenario.confirm(), scenario.confirm()]);

    expect(confirmations[0]?.orderNumber.value).toBe(confirmations[1]?.orderNumber.value);
    expect(scenario.snapshot()).toEqual({ orders: 1, garments: 2, payments: 1 });
  });

  it.each(["photo", "garment"] as const)(
    "QA #35 repairs only the garment affected by a deterministic %s failure",
    async (failureStage) => {
      const scenario = new ControlledGarmentRepairScenario(failureStage);

      await expect(scenario.saveAll()).rejects.toMatchObject({
        failures: [{ index: 1, stage: failureStage }],
      });
      expect(scenario.savedDescriptions()).toEqual(["Blue dress", "Wool coat"]);

      await scenario.retryFailedOnly();

      expect(scenario.savedDescriptions()).toEqual(["Blue dress", "Grey trousers", "Wool coat"]);
      expect(scenario.createCounts()).toEqual({
        "Blue dress": 1,
        "Grey trousers": failureStage === "garment" ? 2 : 1,
        "Wool coat": 1,
      });
    },
  );

  it("QA #40 retries one photo while preserving the session, form fields, UUID and bytes", async () => {
    const scenario = new ControlledPhotoRetryScenario();

    await expect(scenario.submit()).rejects.toThrow("Controlled photo failure");
    const afterFailure = await scenario.snapshot();

    await expect(scenario.submit()).resolves.toBe("file-dress.jpg");
    const afterRetry = await scenario.snapshot();

    expect(afterRetry).toEqual(afterFailure);
    expect(afterRetry).toMatchObject({
      sessionToken: "qa-session-token",
      clientId: "client-qa",
      description: "Blue dress",
      idempotencyKey: "550e8400-e29b-41d4-a716-446655440011",
      price: "45.50",
      dueDate: "2026-09-28",
      deposit: "15.50",
      filename: "dress.jpg",
      bytes: [4, 8, 15, 16, 23, 42],
    });
    expect(scenario.uploadAttempts).toBe(2);
  });

  it.each([
    ["zero", 0, "received"],
    ["negative", -0.01, "received"],
    ["excessive", 42.51, "received"],
    ["collected", 10, "collected"],
    ["cancelled", 10, "cancelled"],
  ] as const)("QA #41 rejects a %s payment without creating a record", async (_case, amount, status) => {
    const scenario = new ControlledPaymentScenario(status);

    await expect(scenario.record(amount)).rejects.toBeDefined();

    expect(scenario.createdPayments).toBe(0);
  });

  it("QA #55 sums known payments and places them in exact Dublin day buckets", async () => {
    const stats = await new KnownPaymentsStatsScenario().read();

    expect(stats.totalIncome.toString()).toBe("65.86");
    expect(stats.paymentsCount).toBe(4);
    expect(stats.incomeBuckets.map((bucket) => [bucket.key, bucket.amount.toString()])).toEqual([
      ["2026-09-21", "30.30"],
      ["2026-09-22", "35.56"],
    ]);
    expect(stats.incomeBuckets.reduce((sum, bucket) => sum + bucket.amount.cents, 0)).toBe(
      stats.totalIncome.cents,
    );
  });
});

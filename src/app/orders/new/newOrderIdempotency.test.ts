import { describe, expect, it } from "vitest";

import { garmentIdempotencySlotsToClear, isNewOrderReconciliationRetryBlocked, shouldFinalizeConfirmedOrder } from "@/app/orders/new/newOrderIdempotency";

describe("garmentIdempotencySlotsToClear", () => {
  it("finalizes a confirmed order without waiting for its follow-up refresh", () => {
    expect(shouldFinalizeConfirmedOrder({ status: "success", mutationResult: "confirmed-saved", orderNumber: "260924-0007" })).toBe(true);
  });

  it("does not finalize an order whose write outcome is still unknown", () => {
    expect(shouldFinalizeConfirmedOrder({ status: "error", mutationResult: "outcome-unknown", orderNumber: "260924-0007" })).toBe(false);
  });

  it("does not finalize before an order number exists", () => {
    expect(shouldFinalizeConfirmedOrder({ status: "error", mutationResult: "confirmed-not-saved" })).toBe(false);
  });

  it("preserves UUID slots whose save result is unknown", () => {
    expect(garmentIdempotencySlotsToClear(4, [1, 2, 3], {
      errorCode: "partialGarmentsUnknown",
      failedPositions: [2, 3],
    })).toEqual([1]);
  });

  it("maps a failed submitted position to its stable slot when rows have gaps", () => {
    expect(garmentIdempotencySlotsToClear(4, [1, 3], {
      errorCode: "partialGarmentsUnknown",
      failedPositions: [2],
    })).toEqual([1, 2]);
  });

  it("clears every garment UUID after confirmed completion", () => {
    expect(garmentIdempotencySlotsToClear(4, [1, 3], { errorCode: null })).toEqual([1, 2, 3]);
  });

  it("clears every garment UUID when failed garments are confirmed absent", () => {
    expect(garmentIdempotencySlotsToClear(3, [1, 2], {
      errorCode: "partialGarments",
      failedPositions: [2],
    })).toEqual([1, 2]);
  });

  it("allows retry only after confirmed absence, not after a content conflict", () => {
    expect(isNewOrderReconciliationRetryBlocked("absent")).toBe(false);
    expect(isNewOrderReconciliationRetryBlocked("conflict")).toBe(true);
    expect(isNewOrderReconciliationRetryBlocked(undefined)).toBe(false);
  });
});

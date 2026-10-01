type OrderFinalizationState = {
  errorCode?: string | null;
  failedPositions?: readonly number[];
};

export function garmentIdempotencySlotsToClear(
  nextGarmentId: number,
  activeGarmentIds: readonly number[],
  state: OrderFinalizationState,
): number[] {
  const uncertainSlots = new Set<number>();
  if (state.errorCode === "partialGarmentsUnknown") {
    for (const position of state.failedPositions ?? []) {
      const slot = activeGarmentIds[position - 1];
      if (slot !== undefined) uncertainSlots.add(slot);
    }
  }
  const slots: number[] = [];
  for (let garmentId = 1; garmentId < nextGarmentId; garmentId += 1) {
    if (!uncertainSlots.has(garmentId)) {
      slots.push(garmentId);
    }
  }
  return slots;
}
export function isNewOrderReconciliationRetryBlocked(
  outcome: "absent" | "conflict" | undefined,
): boolean {
  return outcome === "conflict";
}

type ConfirmedOrderState = {
  status?: string;
  mutationResult?: string;
  orderNumber?: string;
};

export function shouldFinalizeConfirmedOrder(
  state: ConfirmedOrderState,
): boolean {
  return Boolean(state.orderNumber) && state.mutationResult !== "outcome-unknown";
}

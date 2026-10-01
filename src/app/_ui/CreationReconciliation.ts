export type CreationReconciliationState =
  | { status: "idle"; mutationResult?: undefined; error: null }
  | { status: "saved"; mutationResult: "confirmed-saved"; error: null; nextIdempotencyKey: string; orderNumber?: string }
  | { status: "absent"; mutationResult: "confirmed-not-saved"; error: null }
  | { status: "error"; mutationResult: "outcome-unknown" | "confirmed-not-saved"; error: string };

export const initialCreationReconciliationState: CreationReconciliationState = { status: "idle", error: null };

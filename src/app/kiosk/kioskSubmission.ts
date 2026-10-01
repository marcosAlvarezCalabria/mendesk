import type { MutationResult } from "@/application/mutations/MutationResult";

type MutationResultType = MutationResult<unknown>["type"];

export function isKioskSubmissionBlocked(
  isPending: boolean,
  mutationResult: MutationResultType | undefined,
  isOnline: boolean,
): boolean {
  return !isOnline || isPending || mutationResult === "outcome-unknown";
}

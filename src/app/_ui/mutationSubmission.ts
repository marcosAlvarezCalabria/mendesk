import type { MutationResult } from "@/application/mutations/MutationResult";

type MutationResultType = MutationResult<unknown>["type"];

export function isMutationSubmissionBlocked(
  isPending: boolean,
  mutationResult: MutationResultType | undefined,
): boolean {
  return isPending || mutationResult === "outcome-unknown";
}

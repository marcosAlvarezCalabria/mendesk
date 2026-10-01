import { describe, expect, it } from "vitest";

import { isMutationSubmissionBlocked } from "@/app/_ui/mutationSubmission";

describe("isMutationSubmissionBlocked", () => {
  it("blocks while a mutation is pending", () => {
    expect(isMutationSubmissionBlocked(true, undefined)).toBe(true);
  });

  it("blocks a blind retry when Directus has not confirmed the outcome", () => {
    expect(isMutationSubmissionBlocked(false, "outcome-unknown")).toBe(true);
  });

  it.each([undefined, "confirmed-saved", "confirmed-not-saved", "auth-expired"] as const)(
    "does not block a settled %s result",
    (result) => {
      expect(isMutationSubmissionBlocked(false, result)).toBe(false);
    },
  );
});

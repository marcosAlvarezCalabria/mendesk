import { describe, expect, it } from "vitest";

import { isKioskSubmissionBlocked } from "@/app/kiosk/kioskSubmission";

describe("isKioskSubmissionBlocked", () => {
  it("blocks an offline intake before any request can be sent", () => {
    expect(isKioskSubmissionBlocked(false, undefined, false)).toBe(true);
  });

  it("keeps the existing pending and outcome-unknown protections", () => {
    expect(isKioskSubmissionBlocked(true, undefined, true)).toBe(true);
    expect(isKioskSubmissionBlocked(false, "outcome-unknown", true)).toBe(true);
    expect(isKioskSubmissionBlocked(false, "confirmed-not-saved", true)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import { formatPhoneForDisplay } from "@/app/_ui/phoneDisplay";

describe("formatPhoneForDisplay", () => {
  it("formats a normalized Irish mobile number for display", () => {
    expect(formatPhoneForDisplay("353852009225")).toBe("+353 85 200 9225");
  });

  it("leaves an unexpected value unchanged instead of guessing its grouping", () => {
    expect(formatPhoneForDisplay("unknown")).toBe("unknown");
  });

  it("adds the international prefix without guessing another country's grouping", () => {
    expect(formatPhoneForDisplay("34612345678")).toBe("+34612345678");
  });
});

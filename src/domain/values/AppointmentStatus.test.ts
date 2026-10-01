import { describe, expect, it } from "vitest";

import { isAppointmentStatus } from "@/domain/values/AppointmentStatus";

describe("isAppointmentStatus", () => {
  it("accepts known appointment statuses", () => {
    expect(isAppointmentStatus("scheduled")).toBe(true);
  });

  it("rejects unknown appointment statuses", () => {
    expect(isAppointmentStatus("pending")).toBe(false);
  });
});

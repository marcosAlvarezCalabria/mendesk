import { describe, expect, it } from "vitest";

import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import {
  buildAppointmentHistoryHref,
  groupAppointmentHistory,
  parseAppointmentHistoryParams,
  safeAppointmentReturnTo,
} from "@/app/appointments/appointmentHistory";

describe("appointment history params", () => {
  it("preserves a valid query, filter, and accumulated page", () => {
    expect(parseAppointmentHistoryParams({ q: " Mary ", status: "completed", page: "3" })).toEqual({
      q: "Mary",
      filter: "completed",
      page: 3,
    });
    expect(buildAppointmentHistoryHref({ q: "Mary", filter: "completed", page: 3 })).toBe(
      "/appointments/history?q=Mary&status=completed&page=3",
    );
  });

  it("falls back safely for invalid or duplicated parameters", () => {
    expect(parseAppointmentHistoryParams({ q: ["one", "two"], status: "scheduled", page: "0" })).toEqual({
      q: "",
      filter: "all",
      page: 1,
    });
  });
});

describe("appointment history grouping", () => {
  it("keeps only terminal appointments in newest-first Dublin day groups", () => {
    const groups = groupAppointmentHistory([
      item("scheduled", "2026-09-03T18:00:00.000Z", "scheduled"),
      item("older", "2026-09-02T10:30:00.000Z", "cancelled"),
      item("newer", "2026-09-03T15:00:00.000Z", "completed"),
    ]);

    expect(groups.map(group => ({ key: group.key, ids: group.items.map(value => value.id) }))).toEqual([
      { key: "2026-09-03", ids: ["newer"] },
      { key: "2026-09-02", ids: ["older"] },
    ]);
  });
});

describe("safeAppointmentReturnTo", () => {
  it("accepts Agenda and History origins while rejecting external destinations", () => {
    expect(safeAppointmentReturnTo("/appointments?week=2026-09-14")).toBe("/appointments?week=2026-09-14");
    expect(safeAppointmentReturnTo("/appointments/history?q=Mary&status=cancelled&page=2")).toBe(
      "/appointments/history?q=Mary&status=cancelled&page=2",
    );
    expect(safeAppointmentReturnTo("https://evil.invalid")).toBe("/appointments");
  });
});

function item(id: string, scheduledAt: string, status: AppointmentListItem["status"]): AppointmentListItem {
  return { id, clientName: "Client", scheduledAt: new Date(scheduledAt), status };
}

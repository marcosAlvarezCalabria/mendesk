import { describe, expect, it } from "vitest";
import { appointmentWeek, groupScheduledAppointments } from "./appointmentWeek";
import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";

describe("appointmentWeek", () => {
  it("shows only today through Sunday for the current Dublin week", () => {
    const week = appointmentWeek(undefined, new Date("2026-09-11T08:00:00.000Z"));

    expect(week.key).toBe("2026-09-07");
    expect(week.start.toISOString()).toBe("2026-09-06T23:00:00.000Z");
    expect(week.visibleFrom.toISOString()).toBe("2026-09-10T23:00:00.000Z");
    expect(week.end.toISOString()).toBe("2026-09-13T23:00:00.000Z");
    expect(week.isCurrent).toBe(true);
  });

  it("shows complete requested weeks and crosses Dublin DST safely", () => {
    const future = appointmentWeek("2026-10-26", new Date("2026-09-11T08:00:00.000Z"));

    expect(future.start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(future.visibleFrom).toEqual(future.start);
    expect(future.end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
    expect(future.previousKey).toBe("2026-10-19");
    expect(future.nextKey).toBe("2026-11-02");
  });

  it("falls back to the current week for malformed input", () => {
    expect(appointmentWeek("not-a-date", new Date("2026-09-11T08:00:00.000Z")).key).toBe("2026-09-07");
  });
});

describe("groupScheduledAppointments", () => {
  it("keeps only Scheduled rows in range, hides empty days and sorts by time", () => {
    const week = appointmentWeek(undefined, new Date("2026-09-11T08:00:00.000Z"));
    const items = [
      item("late-today", "2026-09-11T15:00:00.000Z"),
      item("early-today", "2026-09-11T09:00:00.000Z"),
      item("completed", "2026-09-11T10:00:00.000Z", "completed"),
      item("before-today", "2026-09-10T12:00:00.000Z"),
      item("sunday", "2026-09-13T10:00:00.000Z"),
    ];

    expect(groupScheduledAppointments(items, week).map(group => ({ key: group.key, ids: group.items.map(row => row.id) }))).toEqual([
      { key: "2026-09-11", ids: ["early-today", "late-today"] },
      { key: "2026-09-13", ids: ["sunday"] },
    ]);
  });
});

function item(id: string, scheduledAt: string, status: AppointmentListItem["status"] = "scheduled"): AppointmentListItem {
  return { id, clientId: "client-1", clientName: "Test client", scheduledAt: new Date(scheduledAt), status };
}

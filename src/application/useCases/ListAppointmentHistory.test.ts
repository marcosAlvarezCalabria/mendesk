import { describe, expect, it } from "vitest";

import type {
  AppointmentHistoryPage,
  AppointmentHistoryQuery,
  AppointmentHistoryReader,
} from "@/application/ports/AppointmentHistoryReader";
import { APPOINTMENT_HISTORY_PAGE_SIZE, ListAppointmentHistory } from "@/application/useCases/ListAppointmentHistory";

describe("ListAppointmentHistory", () => {
  it("requests the accumulated terminal history with normalized search", async () => {
    const reader = new FakeAppointmentHistoryReader();

    await new ListAppointmentHistory(reader).execute({ page: 2, filter: "completed", search: "  Mary  " });

    expect(reader.lastQuery).toEqual({
      limit: APPOINTMENT_HISTORY_PAGE_SIZE * 2,
      search: "Mary",
      status: "completed",
    });
  });

  it("maps All to both terminal states without a status filter", async () => {
    const reader = new FakeAppointmentHistoryReader();

    await new ListAppointmentHistory(reader).execute({ page: 1, filter: "all", search: "   " });

    expect(reader.lastQuery).toEqual({ limit: APPOINTMENT_HISTORY_PAGE_SIZE });
  });

  it.each([
    { page: 0, filter: "all" },
    { page: 1.5, filter: "all" },
    { page: 1, filter: "scheduled" },
  ])("rejects an invalid history query %#", input => {
    const reader = new FakeAppointmentHistoryReader();

    expect(() => new ListAppointmentHistory(reader).execute(input as never)).toThrow();
    expect(reader.lastQuery).toBeNull();
  });
});

class FakeAppointmentHistoryReader implements AppointmentHistoryReader {
  lastQuery: AppointmentHistoryQuery | null = null;

  async listHistory(query: AppointmentHistoryQuery): Promise<AppointmentHistoryPage> {
    this.lastQuery = query;
    return { items: [], hasEarlier: false };
  }
}

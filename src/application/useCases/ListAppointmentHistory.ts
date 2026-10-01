import type {
  AppointmentHistoryPage,
  AppointmentHistoryReader,
} from "@/application/ports/AppointmentHistoryReader";

export type AppointmentHistoryFilter = "all" | "completed" | "cancelled";
export type ListAppointmentHistoryInput = {
  page?: number;
  filter?: AppointmentHistoryFilter;
  search?: string;
};

export const APPOINTMENT_HISTORY_PAGE_SIZE = 20;

export class ListAppointmentHistory {
  constructor(private readonly appointments: AppointmentHistoryReader) {}

  execute(input: ListAppointmentHistoryInput = {}): Promise<AppointmentHistoryPage> {
    const page = input.page ?? 1;
    const filter = input.filter ?? "all";

    if (!Number.isSafeInteger(page) || page < 1 || page > Math.floor(Number.MAX_SAFE_INTEGER / APPOINTMENT_HISTORY_PAGE_SIZE)) {
      throw new RangeError("Page must be a positive integer");
    }

    if (filter !== "all" && filter !== "completed" && filter !== "cancelled") {
      throw new Error("Invalid appointment history filter");
    }

    const search = input.search?.trim() || undefined;
    return this.appointments.listHistory({
      limit: page * APPOINTMENT_HISTORY_PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(filter === "all" ? {} : { status: filter }),
    });
  }
}

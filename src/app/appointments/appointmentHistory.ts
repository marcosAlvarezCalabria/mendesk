import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";
import type { AppointmentHistoryFilter } from "@/application/useCases/ListAppointmentHistory";

export type AppointmentHistoryParams = {
  q: string;
  filter: AppointmentHistoryFilter;
  page: number;
};

export type AppointmentHistoryGroup = { key: string; items: AppointmentListItem[] };

const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function parseAppointmentHistoryParams(params: Record<string, string | string[] | undefined>): AppointmentHistoryParams {
  const q = readSingle(params.q)?.trim() ?? "";
  const requestedFilter = readSingle(params.status);
  const filter = requestedFilter === "completed" || requestedFilter === "cancelled" ? requestedFilter : "all";
  const rawPage = readSingle(params.page) ?? "1";
  const page = /^\d+$/.test(rawPage) && Number.isSafeInteger(Number(rawPage)) && Number(rawPage) > 0 ? Number(rawPage) : 1;

  return { q, filter, page };
}

export function buildAppointmentHistoryHref(params: AppointmentHistoryParams): string {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  if (params.filter !== "all") search.set("status", params.filter);
  if (params.page > 1) search.set("page", String(params.page));
  const query = search.toString();
  return query ? `/appointments/history?${query}` : "/appointments/history";
}

export function groupAppointmentHistory(items: readonly AppointmentListItem[]): AppointmentHistoryGroup[] {
  const groups = new Map<string, AppointmentListItem[]>();
  const sorted = [...items]
    .filter(item => item.status === "completed" || item.status === "cancelled")
    .sort((left, right) => right.scheduledAt.getTime() - left.scheduledAt.getTime() || right.id.localeCompare(left.id));

  for (const item of sorted) {
    if (!Number.isFinite(item.scheduledAt.getTime())) continue;
    const key = dublinDayKey(item.scheduledAt);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups].map(([key, groupedItems]) => ({ key, items: groupedItems }));
}

export function safeAppointmentReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("#")) {
    return "/appointments";
  }

  try {
    const url = new URL(value, "https://panel.invalid");
    if (url.origin !== "https://panel.invalid" || (url.pathname !== "/appointments" && url.pathname !== "/appointments/history")) {
      return "/appointments";
    }
    return value;
  } catch {
    return "/appointments";
  }
}

function readSingle(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

function dublinDayKey(date: Date): string {
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

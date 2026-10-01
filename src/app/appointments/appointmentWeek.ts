import type { AppointmentListItem } from "@/application/dtos/AppointmentListItem";

const DAY_MS = 86_400_000;
const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export type AppointmentWeek = {
  key: string;
  start: Date;
  visibleFrom: Date;
  end: Date;
  previousKey: string;
  nextKey: string;
  isCurrent: boolean;
};

export type AppointmentDayGroup = { key: string; items: AppointmentListItem[] };

export function appointmentWeek(requestedWeek: string | undefined, now = new Date()): AppointmentWeek {
  const today = civilDay(now);
  const currentMonday = monday(today);
  const requested = parseCivilDate(requestedWeek);
  const selectedMonday = requested === null ? currentMonday : monday(requested);
  const isCurrent = selectedMonday === currentMonday;
  const start = midnight(selectedMonday);

  return {
    key: civilKey(selectedMonday),
    start,
    visibleFrom: isCurrent ? midnight(today) : start,
    end: midnight(selectedMonday + 7 * DAY_MS),
    previousKey: civilKey(selectedMonday - 7 * DAY_MS),
    nextKey: civilKey(selectedMonday + 7 * DAY_MS),
    isCurrent,
  };
}

export function groupScheduledAppointments(items: readonly AppointmentListItem[], week: AppointmentWeek): AppointmentDayGroup[] {
  const groups = new Map<string, AppointmentListItem[]>();
  const from = week.visibleFrom.getTime();
  const to = week.end.getTime();

  for (const item of [...items].sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())) {
    const scheduledAt = item.scheduledAt.getTime();
    if (item.status !== "scheduled" || !Number.isFinite(scheduledAt) || scheduledAt < from || scheduledAt >= to) continue;
    const key = civilKey(civilDay(item.scheduledAt));
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  return [...groups].map(([key, groupedItems]) => ({ key, items: groupedItems }));
}

function civilDay(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError("Invalid appointment calendar date");
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

function representedLocalTime(date: Date): number {
  const parts = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

function midnight(civil: number): Date {
  let instant = civil;
  for (let attempt = 0; attempt < 4; attempt++) {
    const represented = representedLocalTime(new Date(instant));
    if (represented === civil) return new Date(instant);
    instant += civil - represented;
  }
  throw new RangeError("Unrepresentable appointment calendar midnight");
}

function monday(civil: number): number {
  const day = new Date(civil).getUTCDay();
  return civil - ((day + 6) % 7) * DAY_MS;
}

function parseCivilDate(value: string | undefined): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const civil = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return civilKey(civil) === value ? civil : null;
}

function civilKey(civil: number): string {
  return new Date(civil).toISOString().slice(0, 10);
}

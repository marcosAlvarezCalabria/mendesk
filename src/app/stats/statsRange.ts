import { parseDublinDateTime } from "@/domain/time/dublinDateTime";

export type RangePreset = "today" | "this_week" | "this_month" | "more";
export type StatsBucket = "hour" | "day" | "week";

const calendar = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

export function normalizeStatsPreset(value: string | undefined): RangePreset {
  if (value === "this_week" || value === "this_month" || value === "more") return value;
  if (value === "custom") return "more";
  return "today";
}

export function resolveStatsRange(presetValue: string, fromValue: string | undefined, toValue: string | undefined, now: Date): { from: Date; to: Date } {
  const preset = normalizeStatsPreset(presetValue);
  const today = localDate(now);

  if (preset === "more") {
    const from = parseLocalDate(fromValue);
    const to = parseLocalDate(toValue ? addDays(toValue, 1) : undefined);
    if (from && to && from < to) return { from, to };
  }

  if (preset === "this_week") {
    const monday = addDays(today.key, -weekdayOffset(today.weekday));
    return { from: requiredLocalDate(monday), to: requiredLocalDate(addDays(monday, 7)) };
  }

  if (preset === "this_month") {
    const start = `${today.year}-${two(today.month)}-01`;
    const nextMonth = new Date(Date.UTC(today.year, today.month, 1));
    const end = `${nextMonth.getUTCFullYear()}-${two(nextMonth.getUTCMonth() + 1)}-01`;
    return { from: requiredLocalDate(start), to: requiredLocalDate(end) };
  }

  return { from: requiredLocalDate(today.key), to: requiredLocalDate(addDays(today.key, 1)) };
}

export function resolveStatsBucket(preset: RangePreset, fromValue: string | undefined, toValue: string | undefined): StatsBucket {
  if (preset === "today") return "hour";
  if (preset !== "more") return "day";
  const from = dateOrdinal(fromValue);
  const to = dateOrdinal(toValue);
  return from !== null && to !== null && to - from + 1 > 31 ? "week" : "day";
}

function localDate(date: Date): { key: string; year: number; month: number; weekday: string } {
  const values = Object.fromEntries(calendar.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return { key: `${values.year}-${values.month}-${values.day}`, year: Number(values.year), month: Number(values.month), weekday: values.weekday };
}

function weekdayOffset(value: string): number {
  return { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[value] ?? 0;
}

function parseLocalDate(value: string | undefined): Date | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseDublinDateTime(`${value}T00:00:00`) : null;
}

function requiredLocalDate(value: string): Date {
  const date = parseLocalDate(value);
  if (!date) throw new Error("Invalid Dublin calendar date");
  return date;
}

function addDays(value: string | undefined, amount: number): string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));
  return `${date.getUTCFullYear()}-${two(date.getUTCMonth() + 1)}-${two(date.getUTCDate())}`;
}

function dateOrdinal(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? Math.floor(date.getTime() / 86_400_000) : null;
}

function two(value: number): string {
  return String(value).padStart(2, "0");
}

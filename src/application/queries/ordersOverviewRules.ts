import type { OrderAttention } from "@/application/dtos/OrdersOverview";
import type { OrderStatusValue } from "@/domain/values/OrderStatus";

const calendar = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Dublin", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const CIVIL_DAY_MS = 86_400_000;

function parts(date: Date) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new RangeError("Invalid operational date");
  const fields = Object.fromEntries(calendar.formatToParts(date).map(part => [part.type, Number(part.value)]));
  return { day: Date.UTC(fields.year, fields.month - 1, fields.day), hour: fields.hour, minute: fields.minute, second: fields.second };
}

function midnight(civilDay: number): Date {
  let instant = civilDay;
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = parts(new Date(instant));
    const represented = local.day + local.hour * 3_600_000 + local.minute * 60_000 + local.second * 1000;
    if (represented === civilDay) return new Date(instant);
    instant += civilDay - represented;
  }
  throw new RangeError("Unrepresentable operational midnight");
}

export function dublinDayRange(now: Date): { start: Date; end: Date } {
  const day = parts(now).day;
  // Advance the civil calendar, then resolve each midnight independently across DST.
  return { start: midnight(day), end: midnight(day + CIVIL_DAY_MS) };
}

export function dublinOverdueDays(dueDate: Date, now: Date): number {
  return Math.max(0, (parts(now).day - parts(dueDate).day) / CIVIL_DAY_MS);
}

export function ordersAttention(status: OrderStatusValue, dueDate: Date, now: Date): OrderAttention | null {
  const dueDay = parts(dueDate).day;
  const today = parts(now).day;
  if (status === "ready") return "ready_for_pickup";
  if (status !== "received") return null;
  return dueDay < today ? "overdue" : dueDay === today ? "due_today" : dueDay === today + CIVIL_DAY_MS ? "due_tomorrow" : null;
}

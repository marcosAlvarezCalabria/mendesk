const formatter = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export function parseDublinDateTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/.exec(value.trim());
  if (!match) return null;
  const requested: Parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]), second: Number(match[6] ?? 0) };
  if (!validCivilParts(requested)) return null;

  const target = asUtc(requested);
  let instant = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    instant += target - asUtc(partsAt(new Date(instant)));
  }
  const parsed = new Date(instant);
  return sameParts(partsAt(parsed), requested) ? parsed : null;
}

export function parseStoredDublinDateTime(value: string): Date | null {
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return parseDublinDateTime(value);
}

export function formatDublinDateTime(date: Date): string {
  const parts = partsAt(date);
  return `${parts.year}-${two(parts.month)}-${two(parts.day)}T${two(parts.hour)}:${two(parts.minute)}:${two(parts.second)}`;
}

function partsAt(date: Date): Parts {
  const values = Object.fromEntries(formatter.formatToParts(date).filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  return { year: values.year, month: values.month, day: values.day, hour: values.hour, minute: values.minute, second: values.second };
}

function validCivilParts(parts: Parts): boolean {
  const date = new Date(asUtc(parts));
  return date.getUTCFullYear() === parts.year && date.getUTCMonth() + 1 === parts.month && date.getUTCDate() === parts.day && parts.hour < 24 && parts.minute < 60 && parts.second < 60;
}

function sameParts(left: Parts, right: Parts): boolean {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute && left.second === right.second;
}

function asUtc(parts: Parts): number { return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second); }
function two(value: number): string { return String(value).padStart(2, "0"); }

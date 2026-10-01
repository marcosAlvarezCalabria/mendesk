import { parseDublinDateTime } from "@/domain/time/dublinDateTime";

export function parseDateTime(value: string): Date | null {
  return parseDublinDateTime(value);
}

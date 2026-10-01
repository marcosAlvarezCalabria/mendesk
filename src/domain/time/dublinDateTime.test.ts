import { describe, expect, it } from "vitest";

import { formatDublinDateTime, parseDublinDateTime, parseStoredDublinDateTime } from "@/domain/time/dublinDateTime";

describe("Dublin local date-time", () => {
  it("parses summer and winter wall times independently of the server timezone", () => {
    expect(parseDublinDateTime("2026-09-12T09:00")?.toISOString()).toBe("2026-09-12T08:00:00.000Z");
    expect(parseDublinDateTime("2026-12-12T09:00")?.toISOString()).toBe("2026-12-12T09:00:00.000Z");
  });

  it("serializes an instant as the wall time expected by a Directus datetime field", () => {
    expect(formatDublinDateTime(new Date("2026-09-12T08:00:00.000Z"))).toBe("2026-09-12T09:00:00");
  });

  it("reads both Directus wall times and offset ISO values", () => {
    expect(parseStoredDublinDateTime("2026-09-12T09:00:00")?.toISOString()).toBe("2026-09-12T08:00:00.000Z");
    expect(parseStoredDublinDateTime("2026-09-12T08:00:00.000Z")?.toISOString()).toBe("2026-09-12T08:00:00.000Z");
  });

  it("rejects malformed and nonexistent local times", () => {
    expect(parseDublinDateTime("bad")).toBeNull();
    expect(parseDublinDateTime("2026-03-29T01:30")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { directusVersionFilter } from "./directusVersionFilter";

describe("Directus initial version filter", () => {
  it("matches an update or an unchanged initial creation, never creation alone", () => {
    const version = "2026-09-08T10:00:00.000Z";
    expect(directusVersionFilter(version)).toEqual({
      _or: [
        { date_updated: { _eq: version } },
        { _and: [{ date_updated: { _null: true } }, { date_created: { _eq: version } }] },
      ],
    });
  });
});

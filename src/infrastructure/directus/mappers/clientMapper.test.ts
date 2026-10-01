import { describe, expect, it } from "vitest";

import { mapClient } from "@/infrastructure/directus/mappers/clientMapper";
import type { DirectusClientRecord } from "@/infrastructure/directus/records";

describe("mapClient", () => {
  it("maps a Directus client record to a domain client", () => {
    const client = mapClient(makeClient({ phone: "085 200 9225", notes: "Prefers mornings" }));

    expect(client.id).toBe("client-1");
    expect(client.name).toBe("Mary");
    expect(client.phone?.value).toBe("353852009225");
    expect(client.gdprConsent).toBe(true);
    expect(client.notes).toBe("Prefers mornings");
  });

  it("maps null notes to undefined", () => {
    const client = mapClient(makeClient({ notes: null }));

    expect(client.notes).toBeUndefined();
  });

  it("maps an anonymized client without a phone", () => {
    const client = mapClient(makeClient({ name: "Deleted client", phone: null, gdpr_consent: false }));

    expect(client.phone).toBeNull();
  });

  it("rejects an active client without a phone", () => {
    expect(() => mapClient(makeClient({ phone: null }))).toThrow("Active Directus client is missing phone");
  });
});

function makeClient(overrides: Partial<DirectusClientRecord> = {}): DirectusClientRecord {
  return {
    id: "client-1",
    name: "Mary",
    phone: "+353 85 200 9225",
    gdpr_consent: true,
    notes: null,
    ...overrides,
  };
}

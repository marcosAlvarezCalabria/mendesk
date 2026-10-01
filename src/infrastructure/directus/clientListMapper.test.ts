import { describe, expect, it } from "vitest";

import { mapClientListItem } from "@/infrastructure/directus/clientListMapper";

describe("mapClientListItem", () => {
  it("maps the compact visible client fields", () => {
    const client = mapClientListItem({ id: "client-1", name: "Mary", phone: "353852009225", gdpr_consent: true });

    expect(client).toEqual({
      id: "client-1",
      name: "Mary",
      phone: expect.objectContaining({ value: "353852009225" }),
      gdprConsent: true,
    });
  });

  it("maps an anonymized list item without a phone", () => {
    const client = mapClientListItem({ id: "client-1", name: "Deleted client", phone: null, gdpr_consent: false });

    expect(client.phone).toBeNull();
  });
});

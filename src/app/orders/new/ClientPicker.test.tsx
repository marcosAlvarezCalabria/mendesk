import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ExistingClientMatchNotice, type ClientPickerTexts } from "@/app/orders/new/ClientPicker";

const texts: ClientPickerTexts = {
  title: "Client",
  existingClient: "Existing client",
  newClient: "New client",
  searchClient: "Search client",
  searchPlaceholder: "Name or phone",
  selected: "Selected",
  changeClient: "Change",
  searching: "Searching...",
  noClients: "No clients",
  searchError: "Search failed",
  retrySearch: "Retry",
  existingPhoneFound: "This phone number already belongs to {name}. Use the existing client to avoid a duplicate.",
  useExistingClient: "Use existing client",
  name: "Name",
  namePlaceholder: "Client name",
  phone: "Phone",
  phonePlaceholder: "353...",
  gdpr: "Consent",
};

describe("ClientPicker", () => {
  it("renders a specific recovery action when a new-client phone already exists", () => {
    const html = renderToStaticMarkup(
      <ExistingClientMatchNotice
        client={{ id: "client-1", name: "Mary Kelly", phone: "353852009225" }}
        onUse={vi.fn()}
        texts={{ existingPhoneFound: texts.existingPhoneFound, useExistingClient: texts.useExistingClient }}
      />,
    );

    expect(html).toContain("This phone number already belongs to Mary Kelly");
    expect(html).toContain("Use existing client");
    expect(html).toContain('data-use-existing-client="true"');
  });
});

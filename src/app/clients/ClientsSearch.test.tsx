import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

import { ClientRow, ClientsSearch } from "@/app/clients/ClientsSearch";

describe("ClientRow", () => {
  it("shows only name and phone without a GDPR badge", () => {
    const html = renderToStaticMarkup(<ClientRow client={{ id: "client-1", name: "Example", phone: "353850000001", gdprConsent: true }} page={1} query="" />);
    expect(html).not.toContain("GDPR");
  });
  it("does not render an actionable stale row", () => {
    const html = renderToStaticMarkup(<ClientRow disabled client={{ id: "client-1", name: "Example", phone: "353850000001", gdprConsent: true }} page={1} query="" />);
    expect(html).not.toContain("href="); expect(html).toContain('aria-disabled="true"');
  });
  it("distinguishes an initial read failure from empty and offers retry", () => {
    const html = renderToStaticMarkup(<ClientsSearch initialError initialPage={{ items: [], hasNextPage: false }} initialPageNumber={1} initialQuery="" texts={{ title: "Clients", searchLabel: "Search", searchPlaceholder: "Search", searching: "Updating", empty: "No clients", previous: "Previous", next: "Next", error: "Read failed", retry: "Try again", newClient: "New client", clear: "Clear search", noResults: "No matches", updated: "Updated" }} />);
    expect(html).toContain("Read failed"); expect(html).toContain("Try again"); expect(html).not.toContain("No clients");
  });
  it("carries the complete Clients origin and a logical row anchor to detail", () => {
    const markup = renderToStaticMarkup(
      <ClientRow
        client={{ id: "client-1", name: "Ada Lovelace", phone: "353871234567", gdprConsent: true }}
        page={2}
        query="Ada Lovelace"
      />,
    );

    expect(markup).toContain('id="client-client-1"');
    expect(markup).toContain(
      'href="/clients/client-1?returnTo=%2Fclients%3Fq%3DAda%2BLovelace%26page%3D2%26anchor%3Dclient-client-1"',
    );
  });

  it("renders an anonymized client without a phone", () => {
    const markup = renderToStaticMarkup(
      <ClientRow client={{ id: "client-1", name: "Deleted client", phone: null, gdprConsent: false }} page={1} query="" />,
    );

    expect(markup).toContain("Deleted client");
    expect(markup).not.toContain("wa.me");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("./actions", () => ({ anonymizeClientAction: vi.fn() }));
vi.mock("@/app/sync/useMutationSync", () => ({ useMutationSync: () => ({ phase: "idle", retry: vi.fn() }) }));
import { AnonymizeClientForm } from "./AnonymizeClientForm";
describe("anonymization confirmation", () => {
  it("hides destructive action in a named menu and requires confirmation inside a dialog", () => {
    const html = renderToStaticMarkup(<AnonymizeClientForm clientId="test" clientName="Example" returnTo="/clients" locale="en" texts={{ confirmation: "Irreversible", submit: "Anonymize", submitting: "Working" }} />);
    expect(html).toContain("<details"); expect(html).toContain("<dialog"); expect(html).toContain("Example");
    expect(html).toContain('name="understood"'); expect(html).toContain("disabled"); expect(html).toContain('aria-label="Client actions"');
  });
});

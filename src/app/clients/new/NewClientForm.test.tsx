import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock("./actions", () => ({ registerClientAction: vi.fn() }));
vi.mock("@/app/sync/useMutationSync", () => ({ useMutationSync: () => ({ phase: "idle", retry: vi.fn() }) }));
import { NewClientForm } from "./NewClientForm";
describe("New client form", () => {
  it.each(["en", "uk"] as const)("renders only name phone and consent in %s", locale => {
    const html = renderToStaticMarkup(<NewClientForm locale={locale} returnTo="/clients" />);
    expect(html).toContain('name="name"'); expect(html).toContain('name="phone"'); expect(html).toContain('name="gdprConsent"');
    expect(html).not.toContain('type="email"'); expect(html).not.toContain('name="notes"');
    expect(html).toContain('aria-live="polite"'); expect(html).toContain("disabled");
  });
});
